import paramiko
import stat

# --- Configuration ---
HOST = "91.108.101.101"
PORT = 65002
USER = "u716384673"
PASS = "Cucaracuchis72*"
REMOTE_PATH = "domains/ashera.psyhackers.org"

def rmtree(sftp, remote_path):
    """Recursively delete a directory."""
    try:
        files = sftp.listdir(remote_path)
        for f in files:
            filepath = f"{remote_path}/{f}"
            try:
                sftp.remove(filepath)
            except IOError:
                rmtree(sftp, filepath)
        sftp.rmdir(remote_path)
    except IOError as e:
        print(f"Failed to remove {remote_path}: {e}")

def cleanup():
    print(f"Connecting to {HOST}...")
    transport = paramiko.Transport((HOST, PORT))
    try:
        transport.connect(username=USER, password=PASS)
        sftp = paramiko.SFTPClient.from_transport(transport)
        
        print(f"Cleaning up {REMOTE_PATH} (preserving 'public_html')...")
        try:
            files = sftp.listdir(REMOTE_PATH)
            for f in files:
                if f == "public_html":
                    continue
                
                full_path = f"{REMOTE_PATH}/{f}"
                print(f"  Deleting {f}...")
                
                try:
                    # Try deleting as file first
                    sftp.remove(full_path)
                except IOError:
                    # Must be a directory
                    rmtree(sftp, full_path)
                    
            print("Cleanup complete.")
                
        except IOError as e:
            print(f"Error listing {REMOTE_PATH}: {e}")
            
        sftp.close()
    except Exception as e:
        print(f"Connection Error: {e}")
    finally:
        transport.close()

if __name__ == "__main__":
    cleanup()
