import sys


def main():
    prompt = sys.stdin.read().strip()
    print("Local Agent 收到：")
    print(prompt)


if __name__ == "__main__":
    main()
