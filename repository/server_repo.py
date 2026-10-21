import socket
from http.server import ThreadingHTTPServer

from core import ChatHandler, get_model_name
from settings.server_settings import SERVER_BIND_HOST, SERVER_PORT


def run_server():
    server = ThreadingHTTPServer((SERVER_BIND_HOST, SERVER_PORT), ChatHandler)
    addresses = sorted({
        item[4][0]
        for item in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)
        if not item[4][0].startswith("127.")
    })
    print(f"Qwen chat is listening on port {SERVER_PORT} (model: {get_model_name()})")
    for address in addresses:
        print(f"http://{address}:{SERVER_PORT}")
    if not addresses:
        print(f"http://<thisdeviceip>:{SERVER_PORT}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
    finally:
        server.server_close()