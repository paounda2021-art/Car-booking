module.exports = {
  apps: [
    {
      name: "car-booking",
      script: "powershell.exe",
      args: "-NoProfile -ExecutionPolicy Bypass -File C:\\apps\\car-booking\\run_server.ps1",
      cwd: "C:\\apps\\car-booking",
      instances: 1,
      autorestart: true,
      watch: false
    }
  ]
};
