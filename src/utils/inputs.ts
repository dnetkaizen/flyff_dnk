import { timer } from "./timer";

type KeyboardEvent = {
    shiftKey?: boolean;
    ctrlKey?: boolean;
    altKey?: boolean;
    key: string;
};

export default class Input {
    public cursorMutation = new Function();

    private mainElm: HTMLElement;
    private pull: Array<
        { key: string; cast: number } | { x: number; y: number }
    > = [];
    private time = 500;
    private emitMouseUp!: Function;
    private emitMouseDown!: Function;
    private emitMouseMove!: Function;
    private mouseReady = false;

    constructor(mainElm: HTMLElement) {
        this.mainElm = mainElm;
        this.log('Input: constructor, iniciando mouse y cursor observer');
        this.initMouse();
        this.initCursorObserver();
    }

    public async send(
        event:
            | { key: string; cast: number }
            | { x: number; y: number; cast: number }
    ) {
        this.pull.push(event);
        const time = this.time;
        this.time += event.cast;
        await timer(time);
        this.update();
        await timer(event.cast);
        this.time -= event.cast;
    }

    public async mouseMoveEmmit(x: number, y: number) {
        if (!this.mouseReady) {
            this.log(`mouseMoveEmmit: handlers no listos aun, saltando move a (${x},${y})`, true);
            return;
        }
        const event_obj = this.moveTemplate(x, y);
        this.emitMouseMove(new MouseEvent("mousemove", event_obj));
        await timer(1);
    }

    public async mouseClickEmmit(x: number, y: number) {
        this.log(`mouseClickEmmit: intento clic en (${x},${y}), mouseReady=${this.mouseReady}`);
        if (!this.mouseReady) {
            this.log('mouseClickEmmit: handlers no inicializados — load event no se disparo o JSEvents no disponible', true);
            return;
        }
        this.log(`mouseClickEmmit: enviando mousedown en (${x},${y})`);
        const event_obj = this.clickTemplate(x, y);
        this.emitMouseDown(new MouseEvent("mousedown", event_obj));
        await timer();
        this.log(`mouseClickEmmit: enviando mouseup en (${x},${y})`);
        this.emitMouseUp(new MouseEvent("mouseup", event_obj));
        this.log(`mouseClickEmmit: clic completado en (${x},${y})`);
    }

    private initMouse() {
        this.log('Input.initMouse: iniciando, readyState=' + document.readyState);

        const tryInit = async () => {
            this.log('Input.initMouse: esperando window.JSEvents...');
            let attempts = 0;
            while (!(<any>window).JSEvents) {
                await timer(100);
                attempts++;
                if (attempts > 100) {
                    this.log('Input.initMouse: timeout esperando JSEvents (10s), abortando', true);
                    return;
                }
            }
            this.log(`Input.initMouse: JSEvents encontrado despues de ${attempts} intentos`);

            const handlers = (<any>window).JSEvents.eventHandlers;
            this.log(`Input.initMouse: total handlers en JSEvents = ${handlers?.length ?? 'null'}`);

            const types = handlers?.map((h: any) => h.eventTypeString).join(', ');
            this.log(`Input.initMouse: tipos de handlers = [${types}]`);

            const mouseup   = handlers?.find((h: any) => h.eventTypeString === 'mouseup');
            const mousedown = handlers?.find((h: any) => h.eventTypeString === 'mousedown');
            const mousemove = handlers?.find((h: any) => h.eventTypeString === 'mousemove');

            this.log(`Input.initMouse: mouseup=${!!mouseup}, mousedown=${!!mousedown}, mousemove=${!!mousemove}`);

            if (!mouseup || !mousedown || !mousemove) {
                this.log('Input.initMouse: faltan handlers de mouse en JSEvents', true);
                return;
            }

            this.emitMouseUp   = mouseup.eventListenerFunc;
            this.emitMouseDown = mousedown.eventListenerFunc;
            this.emitMouseMove = mousemove.eventListenerFunc;
            this.mouseReady    = true;
            this.log('Input.initMouse: handlers asignados, mouseReady=true');
        };

        // La extension carga en document_end, el evento load ya se disparo.
        // Verificamos readyState directamente en lugar de esperar el evento.
        if (document.readyState === 'complete') {
            this.log('Input.initMouse: documento ya cargado, iniciando tryInit directamente');
            tryInit();
        } else {
            this.log('Input.initMouse: documento no cargado aun, esperando evento load');
            window.addEventListener('load', () => {
                this.log('Input.initMouse: evento load recibido');
                tryInit();
            });
        }
    }

    private initCursorObserver() {
        this.log('Input.initCursorObserver: iniciando MutationObserver en document.body');
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(() => {
                const cursor = document.body.style.getPropertyValue('cursor');
                if (cursor.indexOf('curattack') !== -1) {
                    this.log(`Input.cursorObserver: cursor cambio a "${cursor}" — disparando cursorMutation`);
                    this.cursorMutation();
                }
            });
        });
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['style'],
        });
        this.log('Input.initCursorObserver: observer activo');
    }

    private update() {
        const event = this.pull.shift();
        if (!event) return;

        if (Object.hasOwnProperty.call(event, 'key')) {
            if ((<any>event).key === '') return;
            this.log(`Input.update: emitiendo tecla "${(<any>event).key}"`);
            this.keyEmmit((<any>event).key);
        }

        if (Object.hasOwnProperty.call(event, 'x')) {
            this.log(`Input.update: emitiendo clic en (${(<any>event).x},${(<any>event).y})`);
            this.mouseClickEmmit((<any>event).x, (<any>event).y);
        }
    }

    private async keyEmmit(key: string) {
        const event = this.defineKey(key);
        this.log(`Input.keyEmmit: key="${key}" alt=${!!event.altKey} ctrl=${!!event.ctrlKey} shift=${!!event.shiftKey}`);
        this.downExtra(event);
        await timer();
        this.mainElm!.dispatchEvent(new KeyboardEvent('keydown', event));
        await timer();
        this.mainElm!.dispatchEvent(new KeyboardEvent('keyup', event));
        await timer();
        this.upExtra(event);
        this.log(`Input.keyEmmit: key="${key}" enviada`);
    }

    private defineKey(key: string): KeyboardEvent {
        if (key.length === 1) return { key };

        const data = { shiftKey: false, ctrlKey: false, altKey: false };

        const isAlt = key.indexOf('Alt+') !== -1;
        if (isAlt) (key = key.replace('Alt+', '')) && (data.altKey = true);

        const isCtrl = key.indexOf('Ctrl+') !== -1;
        if (isCtrl) (key = key.replace('Ctrl+', '')) && (data.ctrlKey = true);

        const isShift = key.indexOf('Shift+') !== -1;
        if (isShift) (key = key.replace('Shift+', '')) && (data.shiftKey = true);

        return { key, ...data };
    }

    private downExtra(event: KeyboardEvent) {
        if (event.shiftKey) this.mainElm!.dispatchEvent(new KeyboardEvent('keydown', Object.assign({}, event, { key: 'Shift' })));
        if (event.ctrlKey)  this.mainElm!.dispatchEvent(new KeyboardEvent('keydown', Object.assign({}, event, { key: 'Control' })));
        if (event.altKey)   this.mainElm!.dispatchEvent(new KeyboardEvent('keydown', Object.assign({}, event, { key: 'Alt' })));
    }

    private upExtra(event: KeyboardEvent) {
        if (event.shiftKey) this.mainElm!.dispatchEvent(new KeyboardEvent('keyup', Object.assign({}, event, { key: 'Shift' })));
        if (event.ctrlKey)  this.mainElm!.dispatchEvent(new KeyboardEvent('keyup', Object.assign({}, event, { key: 'Control' })));
        if (event.altKey)   this.mainElm!.dispatchEvent(new KeyboardEvent('keyup', Object.assign({}, event, { key: 'Alt' })));
    }

    private log(msg: string, isError = false) {
        if (isError) console.error('[Input]', msg);
        else console.log('[Input]', msg);
        const logEl = document.getElementById('cheats_debug_log');
        if (!logEl) return;
        const time = new Date().toLocaleTimeString('es', { hour12: false });
        const line = document.createElement('div');
        line.style.color = isError ? '#ef5350' : '#90caf9';
        line.style.borderBottom = '1px solid #222';
        line.style.padding = '1px 0';
        line.style.fontSize = '9px';
        line.textContent = `[${time}] ${msg}`;
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
    }

    private clickTemplate(x: number, y: number) {
        return {
            altKey: false, bubbles: true, button: 0, buttons: 1,
            cancelBubble: false, cancelable: true,
            clientX: x, clientY: y, composed: true, ctrlKey: false,
            currentTarget: null, defaultPrevented: true, detail: 1,
            eventPhase: 0, fromElement: null,
            layerX: x, layerY: y, metaKey: false,
            movementX: 0, movementY: 0,
            offsetX: x, offsetY: y, pageX: x, pageY: y,
            relatedTarget: null, returnValue: false,
            screenX: x, screenY: y, shiftKey: false, which: 1, x, y,
        };
    }

    private moveTemplate(x: number, y: number) {
        return {
            altKey: false, bubbles: true, button: 0, buttons: 0,
            cancelBubble: false, cancelable: true,
            clientX: x, clientY: y, composed: true, ctrlKey: false,
            currentTarget: null, defaultPrevented: true, detail: 1,
            eventPhase: 0, fromElement: null,
            layerX: x, layerY: y, metaKey: false,
            movementX: 0, movementY: 0,
            offsetX: x, offsetY: y, pageX: x, pageY: y,
            relatedTarget: null, returnValue: false,
            screenX: x, screenY: y, shiftKey: false, which: 0, x, y,
        };
    }
}
