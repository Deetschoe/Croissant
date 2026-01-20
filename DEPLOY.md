# Deployment Instructions

## Quick Deploy

### Step 1: Find ESP32 Port

```bash
pio device list
```

Look for ESP32-S2. Common ports:
- `/dev/cu.usbmodem01`
- `/dev/cu.usbmodemblackmagic1`

### Step 2: Upload Filesystem FIRST

```bash
pio run -t uploadfs --upload-port /dev/cu.usbmodem01
```

Replace `/dev/cu.usbmodem01` with your actual port from Step 1. **Important:** On macOS, you must use the full `/dev/cu.*` path!

### Step 3: Upload Firmware

1. **Put ESP32 in bootloader mode:**
   - Hold **BOOT** button
   - Press and release **RESET** (while holding BOOT)
   - Release **BOOT**

2. **Upload firmware:**
   ```bash
   pio run -t upload --upload-port /dev/cu.usbmodem01
   ```
   
   Replace `/dev/cu.usbmodem01` with your actual port from Step 1.

## Upload Order

**Always upload filesystem BEFORE firmware!**

After firmware upload, the ESP32 resets and the port becomes unavailable temporarily. Uploading filesystem first ensures both uploads succeed.

## After Deployment

1. Unplug from laptop
2. Power via USB power bank or wall adapter
3. Connect to WiFi: "Croissant" (no password)
4. Visit: `http://192.168.4.1` or `http://192.168.4.1/chat`

## Troubleshooting

### Port Not Found
- Unplug and replug USB cable
- Try different USB port
- Check cable (use data cable, not charge-only)

### Upload Fails
- Put in bootloader mode (BOOT + RESET)
- Try slower upload speed (edit `platformio.ini`)
- Check no other program is using the port

### Filesystem Upload Fails After Firmware
- Upload filesystem FIRST, then firmware
- Or wait 5-10 seconds after firmware upload, then check port again
