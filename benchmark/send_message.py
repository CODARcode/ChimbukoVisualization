import requests


if __name__ == '__main__':
    import sys

    url = 'http://0.0.0.0:5000/messages'
    filename = 'message.bin'
    msz_count = 1
    if len(sys.argv) > 1:
        url = sys.argv[1]
        filename = sys.argv[2]
        msz_count = int(sys.argv[3])

    with open(filename, 'rb') as f:
        binary = f.read()

    for _ in range(msz_count):
        res = requests.post(
            url=url,
            data=binary,
            headers={'Content-Type': 'application/octet-stream'}
        )
