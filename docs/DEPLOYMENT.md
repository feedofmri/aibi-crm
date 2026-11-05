# Running and sharing the demo

The verified entry point is a local Node server at http://127.0.0.1:3000. This URL is not a public reviewer link. The brief allows a demo link “if you have one”; source plus your Loom remain required.

## Reviewer setup

Send the credential-free source ZIP. A reviewer with Node 24+ can unzip it, run `npm start`, and use all sample workflows without an API key. For live extraction, they configure their own Meta or OpenAI credentials in `.env` and restart.

## Hosting the Node application

Use a Node 24 host with persistent disk storage and HTTPS. Run `npm start` from the project root; configure `HOST=0.0.0.0`, the platform-assigned `PORT`, and optionally `DB_PATH` on a persistent volume. Keep API credentials in the hosting service’s secret environment variables. Static hosting alone cannot run the SQLite server.

This prototype has no application login. Before giving a team shared access or placing an API-backed demo on the public internet, put it behind the host’s authenticated access control and add request limits. SQLite must remain on one persistent server instance; multiple replicas with separate disks do not share state. Hosted model costs are borne by the configured key owner.

No hosting account has been configured or deployment claimed in this project. The temporary development key must not be shipped to reviewers or uploaded in a ZIP.
