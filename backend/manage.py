#!/usr/bin/env python
import os
import sys


def main() -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Make sure it's installed and available on "
            "your PYTHONPATH, or activate your virtual environment."
        ) from exc
    # Override default port for runserver
    from django.core.management.commands.runserver import Command as runserver
    runserver.default_port = "3422"

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
