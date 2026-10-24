package connection

import (
	"crypto/hmac"
	"crypto/sha512"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/dropbox/godropbox/errors"
	"github.com/pritunl/pritunl-client/service/errortypes"
	"github.com/pritunl/pritunl-client/service/sprofile"
	"github.com/pritunl/pritunl-client/service/utils"
	"github.com/sirupsen/logrus"
)

const (
	syncConnConnectedTimeout = 150 * time.Second
	syncConnDelay            = 10 * time.Second
)

var (
	clientSyncConn = &http.Client{
		Transport: &http.Transport{
			DisableKeepAlives:   true,
			TLSHandshakeTimeout: 5 * time.Second,
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true,
				MinVersion:         tls.VersionTLS12,
				MaxVersion:         tls.VersionTLS13,
			},
		},
		Timeout: 10 * time.Second,
	}
)

func (c *Connection) SyncConn() {
	connected := false
	for i := 0; i < int(syncConnConnectedTimeout.Seconds()); i++ {
		time.Sleep(1 * time.Second)
		if c.State.IsStopFast() {
			return
		}
		if c.Data.Status == Connected {
			connected = true
			break
		}
	}
	if !connected || c.State.IsStopFast() {
		return
	}

	for i := 0; i < int(syncConnDelay.Seconds()); i++ {
		time.Sleep(1 * time.Second)
		if c.State.IsStopFast() {
			return
		}
	}
	if c.State.IsStopFast() {
		return
	}

	body, err := c.syncConnRequest()
	if err != nil {
		logrus.WithFields(c.Fields(logrus.Fields{
			"error": err,
		})).Error("connection: Failed to sync profile from gateway")
		return
	}
	if body == nil {
		return
	}

	if c.Profile.SystemProfile {
		sprfl := sprofile.Get(c.Profile.Id)
		if sprfl == nil {
			logrus.WithFields(c.Fields(nil)).Error(
				"connection: Missing system profile in gateway sync")
			return
		}

		updated, e := sprfl.SyncApply(body)
		if e != nil {
			logrus.WithFields(c.Fields(logrus.Fields{
				"error": e,
			})).Error("connection: Failed to apply system profile " +
				"gateway sync")
			return
		}

		if updated {
			logrus.WithFields(c.Fields(nil)).Info(
				"connection: Synced system profile from gateway")
		}
	} else {
		c.Data.SendSyncEvent(body)
	}
}

func (c *Connection) syncConnRequest() (body []byte, err error) {
	prfl := c.Profile

	if prfl.OrgId == "" || prfl.UserId == "" || prfl.ServerId == "" ||
		prfl.SyncHash == "" || prfl.SyncToken == "" || prfl.SyncSecret == "" {

		return
	}

	gatewayAddr := c.Data.GatewayAddr
	if gatewayAddr == "" {
		gatewayAddr = getGatewayAddr(c.Data.ClientAddr)
		if gatewayAddr == "" {
			return
		}
	}

	webPort := c.Data.WebPort
	if webPort == 0 {
		webPort = 443
	}

	scheme := "https"
	if c.Data.WebNoSsl {
		scheme = "http"
	}

	pth := fmt.Sprintf(
		"/key/sync/%s/%s/%s/%s",
		prfl.OrgId,
		prfl.UserId,
		prfl.ServerId,
		prfl.SyncHash,
	)

	host := fmt.Sprintf("%s:%d", gatewayAddr, webPort)
	reqUrl := &url.URL{
		Scheme: scheme,
		Host:   ParseAddress(host),
		Path:   pth,
	}

	timestamp := strconv.FormatInt(time.Now().Unix(), 10)

	authNonce, err := utils.RandStr(32)
	if err != nil {
		return
	}

	authStr := strings.Join([]string{
		prfl.SyncToken,
		timestamp,
		authNonce,
		"GET",
		pth,
	}, "&")

	hashFunc := hmac.New(sha512.New, []byte(prfl.SyncSecret))
	hashFunc.Write([]byte(authStr))
	rawSignature := hashFunc.Sum(nil)
	sig := base64.StdEncoding.EncodeToString(rawSignature)

	reqUrl.RawQuery = "ver=2"

	logrus.WithFields(c.Fields(logrus.Fields{
		"host": host,
	})).Info("connection: Post connect configuration sync")

	req, err := http.NewRequest("GET", reqUrl.String(), nil)
	if err != nil {
		err = &errortypes.RequestError{
			errors.Wrap(err, "connection: Sync profile request error"),
		}
		return
	}

	req.Header.Set("Auth-Token", prfl.SyncToken)
	req.Header.Set("Auth-Timestamp", timestamp)
	req.Header.Set("Auth-Nonce", authNonce)
	req.Header.Set("Auth-Signature", sig)
	req.Header.Set("User-Agent", "pritunl")

	res, err := clientSyncConn.Do(req)
	if err != nil {
		err = &errortypes.RequestError{
			errors.Wrap(err, "connection: Sync profile connection error"),
		}
		return
	}
	defer res.Body.Close()

	if res.StatusCode == 480 {
		return
	}

	if res.StatusCode != 200 {
		err = utils.LogRequestError(res, "connection: Gateway sync failed")
		return
	}

	body, err = io.ReadAll(res.Body)
	if err != nil {
		body = nil
		err = &errortypes.ReadError{
			errors.Wrap(err, "connection: Failed to read gateway sync body"),
		}
		return
	}

	return
}
