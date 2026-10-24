import Foundation
import ServiceManagement

let service = SMAppService.daemon(plistName: "com.pritunl.service.plist")

func statusStr(_ status: SMAppService.Status) -> String {
  switch status {
  case .enabled:
    return "enabled"
  case .requiresApproval:
    return "requiresApproval"
  case .notRegistered:
    return "notRegistered"
  case .notFound:
    return "notFound"
  @unknown default:
    return "notRegistered"
  }
}

func printErr(_ msg: String) {
  FileHandle.standardError.write((msg + "\n").data(using: .utf8)!)
}

if CommandLine.arguments.count < 2 {
  printErr("usage: pritunl-service-helper " +
    "register|unregister|status|open-settings")
  exit(1)
}

switch CommandLine.arguments[1] {
case "register":
  do {
    try service.register()
    print("registered")
  } catch {
    printErr("register error: \(error.localizedDescription)")
    print(statusStr(service.status))
  }
case "unregister":
  do {
    try service.unregister()
    print("unregistered")
  } catch {
    printErr("unregister error: \(error.localizedDescription)")
    print(statusStr(service.status))
    exit(1)
  }
case "status":
  print(statusStr(service.status))
case "open-settings":
  SMAppService.openSystemSettingsLoginItems()
  print("opened")
default:
  printErr("usage: pritunl-service-helper " +
    "register|unregister|status|open-settings")
  exit(1)
}

exit(0)
