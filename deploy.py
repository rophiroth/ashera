import paramiko
import os
import sys
import stat
import time
import hashlib

# --- Configuration ---
HOST = "91.108.101.101"
PORT = 65002
USER = "u716384673"
PASS = "Cucaracuchis72*"
REMOTE_BASE = "domains/ashera.psyhackers.org/public_html"

# Local Build Paths
LOCAL_BUILD_DIR = "out"

def calculate_local_md5(filepath):
    """Calculates MD5 hash of a local file."""
    hash_md5 = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def get_remote_checksums(transport, remote_path):
    """
    Executes a command to get all MD5 hashes from the remote server.
    Returns a dict: { 'relative/path/to/file': 'md5hash' }
    """
    print("Fetching remote checksums...")
    checksums = {}
    try:
        session = transport.open_session()
        # Ensure we change to directory first to get relative paths nicely if possible, 
        # or just handle the output.
        # find . -type f -exec md5sum {} + output format: "hash  ./filename"
        cmd = f"cd {remote_path} && find . -type f -exec md5sum {{}} +"
        session.exec_command(cmd)
        
        # Read output
        stdout = session.makefile()
        for line in stdout:
            parts = line.strip().split()
            if len(parts) >= 2:
                md5 = parts[0]
                # filename usually comes as ./path/to/file
                filename = " ".join(parts[1:]) 
                if filename.startswith("./"):
                    filename = filename[2:]
                checksums[filename] = md5
        
        exit_status = session.recv_exit_status()
        if exit_status != 0:
            print("  Warning: Could not fetch remote checksums (directory might be empty or new).")
            
        session.close()
    except Exception as e:
        print(f"  Failed to get remote checksums: {e}")
    
    return checksums

def ensure_remote_dir(sftp, remote_path):
    """Ensures a directory exists on the remote server."""
    dirs = remote_path.split("/")
    current_path = ""
    for d in dirs:
        if not d: continue
        current_path += f"{d}/"
        try:
            attrs = sftp.stat(current_path)
            if not stat.S_ISDIR(attrs.st_mode):
                print(f"Error: {current_path} exists but is not a directory.")
        except IOError:
            try:
                sftp.mkdir(current_path)
            except Exception as e:
                print(f"  Failed to create {current_path}: {e}")

def upload_dir_smart(sftp, transport, local_dir, remote_dir):
    """Syncs directory using MD5 checksums."""
    print(f"Syncing {local_dir} -> {remote_dir}...")
    
    if not os.path.exists(local_dir):
        print(f"ERROR: Local directory '{local_dir}' does not exist. Did you run 'npm run build'?")
        return

    # 1. Get map of existing remote files and their hashes
    remote_hashes = get_remote_checksums(transport, remote_dir)
    print(f"  Found {len(remote_hashes)} existing files on remote.")

    ensure_remote_dir(sftp, remote_dir)
    
    files_to_upload = []

    # 2. Scan local files
    for root, dirs, files in os.walk(local_dir):
        # Create remote directories as we go
        rel_path = os.path.relpath(root, local_dir)
        if rel_path == ".":
            current_remote_dir = remote_dir
        else:
            current_remote_dir = f"{remote_dir}/{rel_path}".replace("\\", "/")
            ensure_remote_dir(sftp, current_remote_dir)
        
        for f in files:
            local_file_abs = os.path.join(root, f)
            # Relative path for map lookup (e.g., "index.html" or "assets/style.css")
            # We need to match the format returned by 'find': unix slashes
            rel_file_path = os.path.normpath(os.path.join(rel_path, f)).replace("\\", "/")
            if rel_file_path.startswith("./"):
                rel_file_path = rel_file_path[2:]
            
            local_md5 = calculate_local_md5(local_file_abs)
            
            # CHECK: Do we need to upload?
            remote_md5 = remote_hashes.get(rel_file_path)
            
            if remote_md5 != local_md5:
                # Difference found (or new file)
                remote_file_abs = f"{current_remote_dir}/{f}".replace("\\", "/")
                files_to_upload.append((local_file_abs, remote_file_abs, f))
            else:
                pass
                # print(f"    Skipping {f} (Identical)")

    # 3. Perform Uploads
    if not files_to_upload:
        print("  All files are up to date! Nothing to do.")
    else:
        print(f"  {len(files_to_upload)} files changed. Uploading...")
        for local, remote, name in files_to_upload:
            print(f"    Up: {name}")
            try:
                sftp.put(local, remote)
                time.sleep(0.01) # Tiny buffer
            except Exception as e:
                 print(f"  FAILED to upload {name}: {e}")

def main():
    print("-------------------------------------------------")
    print(f"Deploying Ashera (Smart Sync) to {HOST}...")
    print("-------------------------------------------------")

    transport = paramiko.Transport((HOST, PORT))
    try:
        transport.connect(username=USER, password=PASS)
        sftp = paramiko.SFTPClient.from_transport(transport)
        
        upload_dir_smart(sftp, transport, LOCAL_BUILD_DIR, REMOTE_BASE)
        
        print("\n-------------------------------------------------")
        print("DEPLOYMENT SYNC COMPLETE!")
        print(f"Visit https://ashera.psyhackers.org to test.")
        print("-------------------------------------------------")
        
        sftp.close()
    except Exception as e:
        print(f"\nCRITICAL ERROR: {e}")
    finally:
        transport.close()

if __name__ == "__main__":
    main()
