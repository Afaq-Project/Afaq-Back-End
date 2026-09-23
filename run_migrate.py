import pty
import os
import sys
import select

def run_interactive():
    pid, fd = pty.fork()
    if pid == 0:
        os.execlp("pnpm", "pnpm", "prisma", "migrate", "dev", "--name", "v2-profile-redesign")
    else:
        while True:
            try:
                r, _, _ = select.select([fd], [], [], 0.1)
                if fd in r:
                    output = os.read(fd, 1024)
                    if not output:
                        break
                    sys.stdout.write(output.decode("utf-8", "ignore"))
                    sys.stdout.flush()
                    if b"continue" in output or b"Are you sure" in output or b"?" in output:
                        os.write(fd, b"y\n")
            except OSError:
                break
        _, status = os.waitpid(pid, 0)
        sys.exit(os.waitstatus_to_exitcode(status))

if __name__ == "__main__":
    run_interactive()
