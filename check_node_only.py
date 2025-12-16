import paramiko

# --- Configuration ---
HOST = "91.108.101.101"
PORT = 65002
USER = "u716384673"
PASS = "Cucaracuchis72*"

def check_node():
    print(f"Connecting to {HOST}...")
    transport = paramiko.Transport((HOST, PORT))
    try:
        transport.connect(username=USER, password=PASS)
        session = transport.open_session()
        print("Checking for 'node -v'...")
        session.exec_command("node -v")
        exit_status = session.recv_exit_status()
        output = session.recv(1024).decode().strip()
        
        if exit_status == 0:
            print(f"SUCCESS: Node.js is available! Version: {output}")
        else:
            print("FAILURE: Node.js was not found or command failed.")
            
        session.close()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        transport.close()

if __name__ == "__main__":
    check_node()
