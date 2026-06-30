const http = require('http');

http.get('http://localhost:3001/api/debug-players', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log("RESPONSE JSON:");
        console.log(data);
        process.exit(0);
    });
}).on('error', (err) => {
    console.error("Error fetching debug endpoint:", err);
    process.exit(1);
});
