import paramiko
import stat

# --- Configuration ---
HOST = "91.108.101.101"
PORT = 65002
USER = "u716384673"
PASS = "Cucaracuchis72*"
REMOTE_PATH = "domains/ashera.psyhackers.cl"

def list_remote():
    print(f"Connecting to {HOST}...")
    transport = paramiko.Transport((HOST, PORT))
    try:
        transport.connect(username=USER, password=PASS)
        sftp = paramiko.SFTPClient.from_transport(transport)
        
        print(f"Listing {REMOTE_PATH}...")
        try:
            files = sftp.listdir_attr(REMOTE_PATH)
            for f in files:
                is_dir = stat.S_ISDIR(f.st_mode)
                marker = "/" if is_dir else ""
                print(f"  {f.filename}{marker}")
                
            if any(f.filename == "public_html" for f in files):
                print("\n-> Found 'public_html'. This is likely the web root.")
            else:
                print("\n-> 'public_html' NOT found matching that specific name.")
                
        except IOError as e:
            print(f"Error listing {REMOTE_PATH}: {e}")
            
        sftp.close()
    except Exception as e:
        print(f"Connection Error: {e}")
    finally:
        transport.close()

if __name__ == "__main__":
    list_remote()
