# Usage

Run `npm run start` and visit [`localhost:8000`](localhost:8000) in a browser.  

The environment variables ROBOT_LOCATION, ROBOT_KEY and ROBOT_KEY_ID must be set, so you can set them separately or start like:

`export ROBOT_LOCATION=mylocation;export ROBOT_KEY=mykey;export ROBOT_KEY_ID=mykeyid;npm run start`

The environment variable PORT can be set to change the port it is serving from (default is 8000).

Edit `src/main.ts` to change the robot logic being run. Edit `static/index.html` to change the layout of the app.
