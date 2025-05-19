# Analytics Doctor

This project provides a simple frontend and backend service for scanning a website for common analytics libraries. It is a work in progress and only implements a basic crawler and detector for Google Analytics, Google Tag Manager, Segment, Meta Pixel and Bing scripts.

## Structure

- `frontend/` – A minimal static webpage that submits a domain to the backend and displays the JSON response.
- `backend/` – A Flask application that crawls up to 500 pages of a site trying different domain variations and returns any analytics libraries detected in script tags.

## Running the Backend with Docker

```
cd backend
# Build the image
docker build -t analytics-doctor .
# Run the container
docker run -p 5000:5000 analytics-doctor
```


The backend uses **flask-cors** to allow requests from the static frontend. If
you are serving the frontend from a different origin, the API will be
accessible without additional configuration.

## Exposing with ngrok

You can expose the local backend using ngrok:

```
ngrok http 5000
```

Take the HTTPS URL provided by ngrok and update `frontend/script.js` to use that endpoint instead of `http://localhost:5000`.
Set the `API_BASE_URL` constant in `frontend/script.js` to the public URL of the backend, for example the HTTPS address provided by ngrok.

## Serving the Frontend

The frontend is static so it can be hosted on any web server. During development you can simply open `frontend/index.html` in your browser.

## Disclaimer

This code is a minimal proof of concept and does not handle advanced scenarios like network request interception or automating user interactions. Further development would be required to fully meet all features described in the project goals.
