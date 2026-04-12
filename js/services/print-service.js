/**
 * EASYON DIAMOND PRINT SERVICE (v84.0) 🖨️💎
 * Centraliseret logik til generering og print af QR-tags.
 */

export function printQrTag(id, name, type = 'Asset') {
    const printWin = window.open('', '_blank', 'width=500,height=700');
    
    // Lav midlertidig QR beholder (usynlig i DOM)
    const tempDiv = document.createElement('div');
    document.body.appendChild(tempDiv);

    try {
        const qr = new QRCode(tempDiv, {
            text: id, 
            width: 250, 
            height: 250,
            colorDark: '#0F172A', 
            colorLight: '#FFFFFF',
            correctLevel: QRCode.Level ? QRCode.Level.H : 2 // Resilience for industrial use
        });

        // Giv biblioteket tid til at rendere
        setTimeout(() => {
            const imgEl = tempDiv.querySelector('canvas') || tempDiv.querySelector('img');
            const imgSrc = imgEl?.tagName === 'CANVAS' ? imgEl.toDataURL() : imgEl?.src;
            document.body.removeChild(tempDiv);
            
            if (!imgSrc) {
                console.error("QR Generation Failed");
                return;
            }

            printWin.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Print QR - ${name}</title>
                    <style>
                        * { margin:0; padding:0; box-sizing:border-box; }
                        body { 
                            font-family:'Helvetica Neue', Arial, sans-serif; 
                            background:white; 
                            display:flex; 
                            flex-direction:column; 
                            align-items:center; 
                            padding:40px 20px; 
                        }
                        .card { 
                            border:3px solid #0F172A; 
                            border-radius:24px; 
                            padding:40px; 
                            width:100%;
                            max-width:350px; 
                            text-align:center; 
                            box-shadow: 0 10px 30px rgba(15,23,42,0.1);
                        }
                        .type-tag {
                            font-size:10px;
                            font-weight:900;
                            text-transform:uppercase;
                            letter-spacing:3px;
                            color:white;
                            background:#0F172A;
                            padding:4px 12px;
                            border-radius:20px;
                            display:inline-block;
                            margin-bottom:20px;
                        }
                        img { width:220px; height:220px; margin: 10px 0; }
                        h2 { font-size:26px; font-weight:900; color:#0F172A; margin-top:16px; line-height:1.1; }
                        p { font-size:12px; color:#64748B; margin-top:8px; font-weight:600; }
                        .id-code { 
                            font-size:9px; 
                            color:#CBD5E1; 
                            margin-top:20px; 
                            font-family:monospace; 
                            background:#F8FAFC;
                            padding:8px;
                            border-radius:8px;
                            word-break:break-all;
                        }
                        .footer { margin-top:30px; border-top:1px solid #E2E8F0; padding-top:10px; width:100%; }
                        .brand { font-size:12px; font-weight:900; letter-spacing:1px; color:#3B82F6; }
                        .print-btn { 
                            margin-top:30px; 
                            padding:15px 40px; 
                            background:#3B82F6; 
                            color:white; 
                            border:none; 
                            border-radius:12px; 
                            font-size:16px; 
                            font-weight:800; 
                            cursor:pointer;
                            box-shadow: 0 4px 14px rgba(59,130,246,0.4);
                        }
                        @media print { .print-btn { display:none; } .card { border:4px solid black; box-shadow:none; } }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="type-tag">${type}</div>
                        <img src="${imgSrc}" />
                        <h2>${name}</h2>
                        <p>Scan for vedligehold & info</p>
                        <div class="id-code">${id}</div>
                        <div class="footer">
                            <div class="brand">EASYON DIAMOND ELITE</div>
                        </div>
                    </div>
                    <button class="print-btn" onclick="window.print()">PRINT TAG 🖨️</button>
                    <script>
                        // Auto-print option could go here
                    </script>
                </body>
                </html>
            `);
            printWin.document.close();

        }, 100);
    } catch (e) {
        console.error("Print Service Error:", e);
    }
}

// EXPOSE GLOBALS for legacy support or one-off calls
window.printQrTag = printQrTag;
