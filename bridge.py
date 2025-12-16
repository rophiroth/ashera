import asyncio
import json
from bleak import BleakClient, BleakScanner
import websockets

# Your Ring's ID
RING_MAC = "32:34:42:35:F1:00"

# Common Health Service UUIDs (Heart Rate is often standard)
HEART_RATE_UUID = "00002a37-0000-1000-8000-00805f9b34fb"

# Global state to hold latest data
ring_state = {
    "connected": False,
    "heartRate": 0,
    "raw": {}
}

async def notification_handler(sender, data):
    """Simple handler to capture data"""
    print(f"Received data from {sender}: {data}")
    # Logic to parse whatever the ring sends would go here
    # For R09 it might be custom byte arrays

async def connect_to_ring():
    print(f"Searching for {RING_MAC}...")
    device = await BleakScanner.find_device_by_address(RING_MAC, timeout=10.0)
    
    if not device:
        print(f"Device {RING_MAC} not found via Scan. Trying direct connection anyway...")
        
    async with BleakClient(RING_MAC) as client:
        print(f"Connected: {client.is_connected}")
        ring_state["connected"] = True
        
        # List all services (for debugging what to subscribe to)
        for service in client.services:
            print(f"[Service] {service}")
            for char in service.characteristics:
                 print(f"  [Char] {char} (Props: {char.properties})")

        # Keep alive loop
        while True:
            await asyncio.sleep(1)

async def ws_handler(websocket):
    """Sends ring status to the Web App"""
    while True:
        await websocket.send(json.dumps(ring_state))
        await asyncio.sleep(1)

async def main():
    # Start Websocket Server
    print("Starting Websocket Bridge on ws://localhost:8765")
    start_server = websockets.serve(ws_handler, "localhost", 8765)
    
    # Start Bluetooth Loop
    await asyncio.gather(
        start_server,
        connect_to_ring()
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Stopping bridge...")
