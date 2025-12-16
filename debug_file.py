import paramiko
import hashlib
import os

# --- Configuration ---
HOST = "91.108.101.101"
PORT = 65002
USER = "u716384673"
PASS = "Cucaracuchis72*"
REMOTE_BASE = "domains/ashera.psyhackers.org/public_html"
FILENAME = "_next/static/chunks/f30d1860ca88423d.js" # Will double check path after find_by_name


def inspect_file():
    print(f"Connecting to {HOST}...")
    
    local_path = f"out/{FILENAME}"
    if os.path.exists(local_path):
        local_size = os.path.getsize(local_path)
        with open(local_path, "rb") as f:
            local_md5 = hashlib.md5(f.read()).hexdigest()
        print(f"LOCAL File: {FILENAME}")
        print(f"  Size: {local_size}")
        print(f"  MD5:  {local_md5}")
    else:
        print(f"LOCAL File NOT FOUND: {local_path}")

    transport = paramiko.Transport((HOST, PORT))
    try:
        transport.connect(username=USER, password=PASS)
        sftp = paramiko.SFTPClient.from_transport(transport)
        
        remote_path = f"{REMOTE_BASE}/{FILENAME}"
        print(f"REMOTE Inspection: {remote_path}...")
        
        try:
            attrs = sftp.stat(remote_path)
            print(f"  Size: {attrs.st_size} bytes")
        except IOError:
             print("  File NOT FOUND on server!")
             return

        # Check MD5 via command
        session = transport.open_session()
        cmd = f"md5sum {remote_path}"
        session.exec_command(cmd)
        stdout = session.makefile()
        output = stdout.read().strip()
        
        # Parse MD5 from output "hash  filename"
        parts = output.split()
        if len(parts) > 0:
            print(f"  Remote MD5: {parts[0]}")
            print(f"  Full Output: {output}")
        session.close()

        sftp.close()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        transport.close()

if __name__ == "__main__":
    inspect_file()
