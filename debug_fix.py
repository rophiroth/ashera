import sys

# FIX: Set CoInitialize security model to MTA (Multi-Threaded Apartment)
# This MUST be done before importing 'bleak' or 'pythoncom'
try:
    sys.coinit_flags = 0
except AttributeError:
    pass

import asyncio
import logging
from bleak import BleakScanner, BleakClient

# Configure Logging
logging.basicConfig(level=logging.DEBUG)

TARGET_ADDRESS = "32:34:42:35:F1:00"

async def main():
    print("----------------------------------------------------------------")
    print("  BLUETOOTH ADVANCED DIAGNOSTIC")
    print("----------------------------------------------------------------")
    print("1. Please open Windows Settings -> Bluetooth & devices")
    print("2. Keep that window OPEN and VISIBLE.")
    print("3. Ensure your Ring is charged and close to the PC.")
    print("----------------------------------------------------------------")
    print("Scanning for 15 seconds (Passive + Active)...")

    # 1. Broad Scan
    devices = await BleakScanner.discover(timeout=15.0)
    found = False
    
    for d in devices:
        name = d.name or "Unknown"
        print(f"  [Found] {d.address} | Name: {name} | RSSI: {d.rssi}")
        if d.address == TARGET_ADDRESS:
            found = True
            print("  >>> TARGET FOUND IN SCAN! <<<")

    if not found:
        print("\n[Warn] Target not in scan list. Attempting direct blind connection anyway...\n")

    # 2. Direct Connection Attempt
    print(f"Connecting to {TARGET_ADDRESS}...")
    try:
        async with BleakClient(TARGET_ADDRESS, timeout=20.0) as client:
            print(f"  >>> CONNECTED! <<<")
            print(f"  Services: {client.services}")
            await asyncio.sleep(5)
    except Exception as e:
        print(f"  [Error] Direct connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
