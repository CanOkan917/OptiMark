"""Asynchronous OMR processing worker (Redis + RQ).

The API process never imports this package's task module directly (it enqueues
jobs by dotted-path string), so heavy OpenCV/NumPy imports stay isolated to the
worker process.
"""
