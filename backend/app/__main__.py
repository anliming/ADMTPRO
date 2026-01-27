from . import create_app


def main() -> None:
    app = create_app()
    app.run(host=app.config["API_HOST"], port=app.config["API_PORT"])


if __name__ == "__main__":
    main()
