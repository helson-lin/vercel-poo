const http = require('http')
const url = require('url')
const net = require('net')
require('dotenv').config()
const PORT = process.env.PORT || 3000;

// 创建 HTTP 代理服务器
const server = http.createServer((req, res) => {
    console.log(`HTTP request: ${req.method} ${req.url}`);
    if (!req.url) {
        res.statusCode = 500;
        res.end("server error");
        return;
    }
    // 解析请求 URL
    const { hostname, port, path } = url.parse(req.url, true);
    if (!hostname || !path) {
        res.statusCode = 400;
        res.end("Bad Request");
        return;
    }
    // 创建一个向目标服务器的 HTTP 请求
    const proxyReq = http.request(
        {
            hostname,
            port: port || 80,
            path,
            method: req.method,
            headers: req.headers,
        },
        (proxyRes) => {
            console.log(`HTTP response: ${proxyRes.statusCode}`);
            res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
            try {
                proxyRes.pipe(res)
            } catch {
                console.log("pipe error res")
            }
        }
    );
    proxyReq.on("error", (error) => {
        console.error(
            `Error occurred while proxying request: ${error.message}`
        );
        res.statusCode = 500;
        res.end("Proxy error");
    });
    try {

        req.pipe(proxyReq);
    } catch {
        console.log('pip error')
        res.end('proxy error')
    }
});

// 创建 TCP 代理服务器
server.on("connect", (req, cltSocket, head) => {
    console.log(`TCP request: ${req.method} ${req.url}`);
    // 解析请求 URL
    const { hostname, port } = url.parse(`http://${req.url}`, true);
    if (!hostname || !port) {
        cltSocket.end("Bad Request");
    } else {
        // 创建一个向目标服务器的 TCP 连接
        const srvSocket = net.connect(Number(port) || 80, hostname, () => {
            console.log(
                `TCP connection established: ${hostname}:${port || 80}`
            );
            // 在需要写入数据时进行额外的检查
            if (srvSocket.writable) {
                cltSocket.write(
                    "HTTP/1.1 200 Connection Established\r\n" + "\r\n"
                );
                srvSocket.write(head);
            } else {
                console.error(
                    "Target server connection is no longer writable."
                );
                // 进行相应的异常处理或重试操作
            }
            try {
                srvSocket.pipe(cltSocket);
                cltSocket.pipe(srvSocket);
            } catch (e) {
                srvSocket.end('proxy error')
                cltSocket.end('proxy error')
            }
        });
        srvSocket.on("error", (error) => {
            if (error.code === "ECONNRESET") {
                console.error("Connection reset by remote server.");
                cltSocket.end("Proxy error");
                // 进行相应的异常处理或重试操作
            } else {
                console.error(
                    `Error occurred while establishing TCP connection: ${error.message}`
                );
                cltSocket.end("Proxy error");
            }
        });
    }
});

    // 监听端口
    server.listen(PORT, () => {
        console.log(`HTTP proxy server is listening on port ${PORT}.`);
    });
