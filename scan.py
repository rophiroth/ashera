import asyncio
from bleak import BleakScanner

async def scan():
    print("Scanning for 10 seconds...")
    devices = await BleakScanner.discover(timeout=10.0)
    
    print(f"Found {len(devices)} devices:")
    for d in devices:
        print(f"  {d.address} - {d.name} (RSSI: {d.rssi})")
        # Check if address matches user's ID partially or exactly
        if "32:34:42:35:F1:00" in d.address.upper():
            print("  *** TARGET FOUND! ***")

if __name__ == "__main__":
    asyncio.run(scan())
