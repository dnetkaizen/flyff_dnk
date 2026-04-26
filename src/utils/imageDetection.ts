export interface DetectionResult {
    found: boolean;
    x: number;
    y: number;
    confidence: number;
}

export class ImageDetection {
    private templateImage: HTMLImageElement | null = null;
    private templateCanvas: HTMLCanvasElement;
    private templateCtx: CanvasRenderingContext2D;
    private isLoaded = false;

    constructor() {
        this.templateCanvas = document.createElement('canvas');
        this.templateCtx = this.templateCanvas.getContext('2d')!;
    }

    public isTemplateLoaded(): boolean {
        return this.isLoaded;
    }

    /**
     * Load the template image to search for
     */
    public async loadTemplate(dataUrl: string): Promise<boolean> {
        this.log(`loadTemplate: inicio, url tipo=${dataUrl?.substring(0, 20)}...`);

        if (!dataUrl) {
            this.log('loadTemplate: dataUrl es null/undefined', true);
            throw new Error('dataUrl vacio');
        }

        try {
            this.log('loadTemplate: decodificando base64 a Blob...');
            const commaIdx = dataUrl.indexOf(',');
            const mime = dataUrl.substring(5, dataUrl.indexOf(';'));
            const base64 = dataUrl.substring(commaIdx + 1);
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: mime });
            this.log(`loadTemplate: Blob creado, size=${blob.size} bytes, tipo=${mime}`);

            this.log('loadTemplate: creando ImageBitmap...');
            const bitmap = await createImageBitmap(blob);
            this.log(`loadTemplate: ImageBitmap ok, ${bitmap.width}x${bitmap.height}`);

            this.templateCanvas.width = bitmap.width;
            this.templateCanvas.height = bitmap.height;
            this.templateCtx.drawImage(bitmap, 0, 0);
            bitmap.close();

            const check = this.templateCtx.getImageData(0, 0, 4, 4);
            this.log(`loadTemplate: primeros 4 pixeles RGBA = [${Array.from(check.data.slice(0, 16)).join(',')}]`);

            this.isLoaded = true;
            this.log('loadTemplate: template listo');
            return true;
        } catch (err) {
            this.log(`loadTemplate: fallo en createImageBitmap: ${err}`, true);
            throw false;
        }
    }

    private log(msg: string, isError = false) {
        if (isError) console.error('[ImageDetection]', msg);
        else console.log('[ImageDetection]', msg);
        const logEl = document.getElementById('cheats_debug_log');
        if (!logEl) return;
        const time = new Date().toLocaleTimeString('es', { hour12: false });
        const line = document.createElement('div');
        line.style.color = isError ? '#ef5350' : '#ccc';
        line.style.borderBottom = '1px solid #222';
        line.style.padding = '1px 0';
        line.style.fontSize = '9px';
        line.textContent = `[${time}] ${msg}`;
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
    }

    /**
     * Detect the template image in the game canvas
     */
    public detectInCanvas(gameCanvas: HTMLCanvasElement, threshold = 0.8): DetectionResult {
        this.log(`detectInCanvas: inicio, threshold=${threshold}`);

        if (!this.isLoaded) {
            this.log('detectInCanvas: template no cargado', true);
            return { found: false, x: 0, y: 0, confidence: 0 };
        }

        const templateWidth = this.templateCanvas.width;
        const templateHeight = this.templateCanvas.height;
        const gameWidth = gameCanvas.width;
        const gameHeight = gameCanvas.height;

        this.log(`detectInCanvas: template=${templateWidth}x${templateHeight}, canvas=${gameWidth}x${gameHeight}`);

        // El canvas del juego usa WebGL — copiarlo a un canvas 2D temporal
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = gameWidth;
        tempCanvas.height = gameHeight;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) {
            this.log('detectInCanvas: no se pudo crear canvas 2d temporal', true);
            return { found: false, x: 0, y: 0, confidence: 0 };
        }
        tempCtx.drawImage(gameCanvas, 0, 0);
        this.log('detectInCanvas: canvas WebGL copiado a canvas 2D temporal');

        const templateData = this.templateCtx.getImageData(0, 0, templateWidth, templateHeight);
        const gameData = tempCtx.getImageData(0, 0, gameWidth, gameHeight);

        const gameSample = Array.from(gameData.data.slice(0, 8)).join(',');
        this.log(`detectInCanvas: muestra canvas[0..7]=[${gameSample}]`);

        const allZeroGame = gameData.data.every(v => v === 0);
        if (allZeroGame) this.log('detectInCanvas: ADVERTENCIA canvas completamente en cero (WebGL sin preserveDrawingBuffer)', true);

        // Contar pixeles utiles del template (no blancos) y muestrear centro
        let usefulPixels = 0;
        for (let i = 0; i < templateData.data.length; i += 4) {
            if (templateData.data[i] <= 230 || templateData.data[i+1] <= 230 || templateData.data[i+2] <= 230)
                usefulPixels++;
        }
        this.log(`detectInCanvas: pixeles utiles (no blancos): ${usefulPixels} de ${templateWidth * templateHeight} (${((usefulPixels/(templateWidth*templateHeight))*100).toFixed(1)}%)`);

        // Muestras de distintas zonas del template
        const sample = (x: number, y: number) => {
            const i = (y * templateWidth + x) * 4;
            return `(${x},${y})=[${templateData.data[i]},${templateData.data[i+1]},${templateData.data[i+2]}]`;
        };
        const cx = Math.floor(templateWidth / 2);
        const cy = Math.floor(templateHeight / 2);
        this.log(`detectInCanvas: template samples -> centro ${sample(cx,cy)} | cuarto ${sample(cx>>1,cy>>1)} | borde ${sample(2,2)}`);

        if (usefulPixels < 100) {
            this.log('detectInCanvas: ADVERTENCIA muy pocos pixeles utiles - el template puede estar corrompido o ser todo blanco', true);
        }

        // Limitar zona de busqueda al centro del canvas para reducir tiempo de escaneo
        const MARGIN_X = Math.floor(gameWidth * 0.15);
        const MARGIN_Y = Math.floor(gameHeight * 0.15);
        const searchX0 = MARGIN_X;
        const searchY0 = MARGIN_Y;
        const searchX1 = gameWidth  - MARGIN_X - templateWidth;
        const searchY1 = gameHeight - MARGIN_Y - templateHeight;
        const STRIDE = 4; // stride mayor = mas rapido, menos preciso

        this.log(`detectInCanvas: zona busqueda x=[${searchX0}..${searchX1}] y=[${searchY0}..${searchY1}] stride=${STRIDE}`);

        let bestMatch = { x: 0, y: 0, confidence: 0 };
        let searchCount = 0;
        const t0 = performance.now();

        for (let y = searchY0; y <= searchY1; y += STRIDE) {
            for (let x = searchX0; x <= searchX1; x += STRIDE) {
                searchCount++;
                const confidence = this.calculateMatchScore(gameData, templateData, x, y, gameWidth, templateWidth, templateHeight);

                if (confidence > bestMatch.confidence) {
                    bestMatch = { x: x + templateWidth / 2, y: y + templateHeight / 2, confidence };
                }

                if (confidence > 0.95) {
                    this.log(`detectInCanvas: match excelente en (${bestMatch.x},${bestMatch.y}) conf=${confidence.toFixed(3)}, deteniendo`);
                    return { found: true, ...bestMatch };
                }
            }
        }

        const elapsed = (performance.now() - t0).toFixed(0);
        this.log(`detectInCanvas: escaneo completado en ${elapsed}ms, posiciones=${searchCount}, mejor conf=${bestMatch.confidence.toFixed(3)} en (${bestMatch.x},${bestMatch.y})`);

        // Muestrear pixeles del canvas en la zona del mejor match para comparar con template
        const mx = Math.floor(bestMatch.x - templateWidth / 2);
        const my = Math.floor(bestMatch.y - templateHeight / 2);
        const sampleGame = (x: number, y: number) => {
            const i = (y * gameWidth + x) * 4;
            return `(${x},${y})=[${gameData.data[i]},${gameData.data[i+1]},${gameData.data[i+2]}]`;
        };
        const mcx = mx + Math.floor(templateWidth / 2);
        const mcy = my + Math.floor(templateHeight / 2);
        this.log(`detectInCanvas: canvas en zona match -> centro ${sampleGame(mcx, mcy)} | esquina ${sampleGame(mx, my)} | cuarto ${sampleGame(mx + templateWidth/4, my + templateHeight/4)}`);
        this.log(`detectInCanvas: template centro=[57,48,105] vs canvas centro=[${gameData.data[(mcy*gameWidth+mcx)*4]},${gameData.data[(mcy*gameWidth+mcx)*4+1]},${gameData.data[(mcy*gameWidth+mcx)*4+2]}]`);

        if (bestMatch.confidence >= threshold) {
            this.log(`detectInCanvas: ENCONTRADO conf=${bestMatch.confidence.toFixed(3)} >= threshold=${threshold}`);
            return { found: true, ...bestMatch };
        }

        this.log(`detectInCanvas: no encontrado, conf=${bestMatch.confidence.toFixed(3)} < threshold=${threshold}`);
        this.log(`SOLUCION: tomar screenshot del monstruo en el juego y usarlo como template`);
        return { found: false, x: 0, y: 0, confidence: bestMatch.confidence };
    }

    /**
     * Calculate match score between template and game region
     */
    private calculateMatchScore(
        gameData: ImageData,
        templateData: ImageData,
        offsetX: number,
        offsetY: number,
        gameWidth: number,
        templateWidth: number,
        templateHeight: number
    ): number {
        let score = 0;
        let totalPixels = 0;

        for (let ty = 0; ty < templateHeight; ty += 2) {
            for (let tx = 0; tx < templateWidth; tx += 2) {
                const templateIdx = (ty * templateWidth + tx) * 4;

                const tr = templateData.data[templateIdx];
                const tg = templateData.data[templateIdx + 1];
                const tb = templateData.data[templateIdx + 2];

                // Ignorar pixeles blancos/casi blancos del fondo del template
                if (tr > 230 && tg > 230 && tb > 230) continue;

                const gx = offsetX + tx;
                const gy = offsetY + ty;
                const gameIdx = (gy * gameWidth + gx) * 4;

                const rDiff = Math.abs(tr - gameData.data[gameIdx]);
                const gDiff = Math.abs(tg - gameData.data[gameIdx + 1]);
                const bDiff = Math.abs(tb - gameData.data[gameIdx + 2]);

                const pixelSimilarity = 1 - (rDiff + gDiff + bDiff) / (255 * 3);
                score += pixelSimilarity;
                totalPixels++;
            }
        }

        if (totalPixels === 0) return 0;
        return score / totalPixels;
    }

    /**
     * Detect using color-based method (faster but less accurate)
     */
    public detectByColor(
        gameCanvas: HTMLCanvasElement,
        targetColor: { r: number; g: number; b: number },
        tolerance = 30
    ): DetectionResult[] {
        const ctx = gameCanvas.getContext('2d');
        if (!ctx) return [];

        const imageData = ctx.getImageData(0, 0, gameCanvas.width, gameCanvas.height);
        const matches: DetectionResult[] = [];

        for (let y = 0; y < gameCanvas.height; y += 5) {
            for (let x = 0; x < gameCanvas.width; x += 5) {
                const idx = (y * gameCanvas.width + x) * 4;
                const r = imageData.data[idx];
                const g = imageData.data[idx + 1];
                const b = imageData.data[idx + 2];

                const colorDiff = Math.abs(r - targetColor.r) + 
                                Math.abs(g - targetColor.g) + 
                                Math.abs(b - targetColor.b);

                if (colorDiff < tolerance * 3) {
                    matches.push({
                        found: true,
                        x,
                        y,
                        confidence: 1 - colorDiff / (tolerance * 3)
                    });
                }
            }
        }

        return matches;
    }
}
