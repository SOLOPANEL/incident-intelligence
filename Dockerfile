# One image, shared by all the Python services (consumer, analyzer, ML detector,
# explainer, triage, API, feedback processor). Which script runs is decided by
# the "command" line for each service in docker-compose.yml, not by this file.

FROM python:3.11-slim

WORKDIR /app

# Without this, Python buffers print() output inside the container and
# nothing shows up in `docker logs` until the buffer fills or the process exits.
ENV PYTHONUNBUFFERED=1

# Install the CPU-only version of PyTorch FIRST, before anything else pulls it in.
# Without this, sentence-transformers drags in the full GPU/CUDA build (500MB+
# extra, and useless anyway since these containers have no GPU).
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Now install everything else — torch is already satisfied, so pip won't replace it
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all the project's Python files in
COPY *.py .

# Default command (overridden per-service in docker-compose.yml)
CMD ["python", "api.py"]