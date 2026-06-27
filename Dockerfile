FROM python:3.10-slim

WORKDIR /code

COPY ./backend/requirements.txt /code/requirements.txt

RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

COPY ./backend /code/backend

# Hugging Face එකේ පෝට් එක 7860 නිසා මේක අනිවාර්යයි
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]