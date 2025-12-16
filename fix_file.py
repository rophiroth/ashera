import paramiko
import os

HOST = "91.108.101.101"
PORT = 65002
USER = "u716384673"
PASS = "Cucaracuchis72*"
REMOTE_BASE = "domains/ashera.psyhackers.org/public_html"
FILENAME = "_next/static/chunks/f30d1860ca88423d.js" 

def fix():
    print(f"Connecting to {HOST}...")
    transport = paramiko.Transport((HOST, PORT))
    try:
        transport.connect(username=USER, password=PASS)
        sftp = paramiko.SFTPClient.from_transport(transport)
        
        remote_path = f"{REMOTE_BASE}/{FILENAME}"
        local_path = f"out/{FILENAME}"
        
        print(f"Target: {remote_path}")
        
        # 1. Delete remote
        try:
            sftp.remove(remote_path)
            print("  Deleted existing remote file.")
        except IOError:
            print("  Remote file didn't exist (or error deleting).")
            
        # 2. Upload local
        print("  Uploading local copy...")
        sftp.put(local_path, remote_path)
        print("  Upload complete.")
        
        # 3. Check verify again?
        attrs = sftp.stat(remote_path)
        print(f"  New Remote Size: {attrs.st_size}")
        
        sftp.close()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        transport.close()

if __name__ == "__main__":
    fix()
