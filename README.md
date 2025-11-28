Node Runner - Upload & extract Node.js projects
----------------------------------------------
What's included:
- node-runner-express.js : Express app
- views/index.ejs, views/sites.ejs : simple UI
- package.json : dependencies list

How to run:
1. npm install
2. node node-runner-express.js
3. Open http://localhost:3000 and upload a .zip of your project

Security:
- This app extracts uploaded archives into ./sites and does NOT execute uploaded code automatically.
- Do not run on a public server without adding authentication and sandboxing (Docker).
