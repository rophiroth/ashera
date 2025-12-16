import asyncio
import logging
import sys

# Configure logging to see everything
logging.basicConfig(level=logging.DEBUG, stream=sys.stdout)
logger = logging.getLogger("colmi_r02_client")
logger.setLevel(logging.DEBUG)

# Just in case the address needs capitalization
ADDRESS = "32:34:42:35:F1:00"

try:
    from colmi_r02_client.client import Client
except ImportError:
    print("Error: colmi_r02_client not found. Make sure it is installed.")
    sys.exit(1)

async def main():
    print(f"Attempting to connect to {ADDRESS} using colmi_r02_client...")
    try:
        # Client context manager handles connect/disconnect
        async with Client(ADDRESS) as client:
            print("Connected successfully!")
            
            print("Getting Device Info...")
            try:
                info = await client.get_device_info()
                print(f"Device Info: {info}")
            except Exception as e:
                print(f"Device Info failed: {e}")

            print("Getting Battery...")
            try:
                bat = await client.get_battery()
                print(f"Battery: {bat}")
            except Exception as e:
                print(f"Battery fetch failed: {e}")
            
    except Exception as e:
        print(f"\nCRITICAL CONNECTION ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
