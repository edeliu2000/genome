from .api.app import app
import multiprocessing
if __name__ == "__main__":
    multiprocessing.set_start_method('spawn')
    app.run(use_reloader=True, debug=True)
