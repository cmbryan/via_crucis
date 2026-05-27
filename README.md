# Via Crucis Online Reader

This is a minimal static website that turns your PDF into an interactive page-flip reading experience.

## Local preview

Open `index.html` directly in a browser, or run a lightweight local server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish on GitHub Pages

1. Create a GitHub repository and push this folder.
2. In GitHub: `Settings` -> `Pages`.
3. Under `Build and deployment`, choose:
   - Source: `Deploy from a branch`
   - Branch: `main` (or your default), folder `/ (root)`
4. Save, then wait for deployment.
5. Your site will be available at `https://<your-username>.github.io/<repo-name>/`.

## Replace the PDF

1. Replace `via_crucis_chapter_1.pdf` with your latest PDF.
2. If the filename changes, update `PDF_FILE` in `app.js`.
