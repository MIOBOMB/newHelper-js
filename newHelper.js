/*
 * Стиль комментариев
 * FIXME - странное поведение функции, которое желательно бы переделать
 * ??? - требует уточнения
 * !!! - обратите внимание
 * 
 * Перед вами код newHelper.js версии 2.1.2, он построен на базе гибкой псевдофабрики
 * Которая начинается с _=function(){...}();
 * Если у вас есть конфликты с Lodash вы можете переименовать _ на всё что вам нужно
 * 
 * НЕСТАБИЛЬНОЕ API (НЕ РЕКОМЕНДУЕТСЯ ДЛЯ PRODUCTION):
 * модуль _.autoForm
 * _.win.read()
 * _.win.write()
 * 
 * УДАЛЕНО (вернётся позже):
 * модуль _.err
 */


_=function(){let _={
link:{
	/*
	 * МОДУЛЬ ССЫЛОК
	 * 
	 * Работает по принципу [ссылка, команды...]
	 * Пример: ?page=home&debug&lang=ru
	 *          ^^^^^^^^  ^^^^^  ^^^^^^
	 *          страница  команды
	 * 
	 * В процессе разработки ядра 2.0 в Object hub я понял
	 * Что команды могут быть очень полезными для отладки
	 * Но в теории на них можно повешать все модальные и прочие действия
	 * 
	 * !!!: в функции get() работает весь роутинг, в т.ч. вложенный для страниц
	 */
	basePage:()=>{},
	defTitle:'',
	actions:{},
	commands:{},

	_i: true, // _i - блокировщик pushState в set()
	_cmd:[],
	compile:()=>location.search.replace('?','').split('&'),
	set(page,title=this.defTitle){
		if (title) _.$.D.title=title;
		if (!this._i){
			let link=this.compile();
			link[0]=page;
			history.pushState(null,null,'?'+link.join('&'));
		}
		this._i=false;
	},
	add(cmd){
		let link=this.compile();
		if (!link.includes(cmd)){
			link.push(cmd);
			this._cmd.push(cmd);
			history.replaceState(null,null,'?'+link.join('&'));
		}
	},
	remove(cmd){
		let link=this.compile();
		if (link.includes(cmd)){
			let c=this._cmd;
			link.splice(link.indexOf(cmd),1);
			c.splice(c.indexOf(cmd),1);
			history.replaceState(null,null,'?'+link.join('&'));
		}
	},
	get(){
		/*
		 * Страницы бросают ошибку чтобы вызвать базовую страницу
		 * Команды тем временем так не делают
		 * Потому что сломанная команда не так страшна как сломанная страница
		 * 
		 * При popstate команды берутся из хранилища _cmd, вместо самой ссылки
		 * Сделано это для переноса команд при прыжках по истории
		 */
		let links=this.compile(),
			[firstKey,fisrtValue]=links[0].split('='),
			cmds=links.slice(1);
		try {
			let dirs=firstKey.split('/'),
				dir=this.actions,
				main=dir[firstKey];
			if (!firstKey.includes('/')){
				main(fisrtValue);
			} else {
				for (let p of dirs){
					let kDir=dir[p+'/'];
					if (kDir)
						dir=kDir;
					else{
						dir[p](fisrtValue);
						break;
					}
				}
			}
		}catch(e){
			this.basePage();
			throw e;
		}
		this._cmd=cmds;
		cmds.forEach(cmmdPre=>{
			let [key,value]=cmmdPre.split('=');
			let cmd=this.commands[key];
			if (cmd) cmd(value);
			else console.error(new Error(`command '${cmd}' doesn't exist!`))
		});
	},
},
lazy:{
	/*
	 * МОДУЛЬ ЛЕНИ
	 * 
	 * Создаёт в глобальной области видимости прокси функции
	 * Вызывающие загрузку скрипта с внещним модулем
	 * Был сделан через глобальную область, так намного проще создавать лень
	 * 
	 * !!!: Функции обёртки в register() должны быть повешаны на window
	 *      Иначе lazy._ провалится в рекурсию ошибок, не наступайте на мои грабли
	 * 
	 * ???: будет ли легче создавать лень в легаси проектах через es6 импорты
	 */
	loaded:{},
	load(url,...args){
		let key=url.split('?')[0], // отсекаем параметры, чтобы не дублировать
			state=this.loaded,
			c=state[key];

		/*
		 * ...args передаются в Promise.resolve(args)
		 * Это позволяет делать _.lazy.load('script.js', 'данные', 'для', 'колбека')
		 * И потом в .then((a,b,c)=>...) получать эти аргументы
		 * 
		 * Тройное состояние скрипта в lazy.loaded:
		 * - true: уже загружен => сразу резолвим
		 * - Promise: грузится сейчас => ждём тот же промис
		 * - undefined: ещё не грузили => создаём новый промис
		 * 
		 * Это защита от двойной загрузки одного скрипта
		 */
		if (c=== true) return Promise.resolve(args);
		if (c instanceof Promise) return c.then(()=>args);

		let pr=new Promise((resolve,reject)=>{
			let scr=_.$.D.createElement('script');
			scr.src=url;
			scr.onload=()=>{
				state[key]=true;
				resolve(args);
			};
			scr.onerror=()=>{
				delete state[key];
				reject(new Error('Failed to load '+url));
			};
			_.$.D.head.append(scr);
		});
		state[key]=pr;
		return pr;
	},
	register(scr,funcs){
		if (!Array.isArray(funcs)) return new Error('Array required for register');

		for (let fn of funcs)
			window[fn]=(...a)=>this._(scr,fn).then(f=>f(...a));
			// ???: добавить вложенность с созданием объектов-обёрток

		console.info('lazy> Applied lazy '+scr+' with this functions:',funcs);
		// ???: не мешает ли тут console.info
	},
	async _(scr,fn){
		let w=window,
			wrapper=w[fn]; 
		try{await this.load(scr)}
		catch(e){throw e}
		if (wrapper!== w[fn]) return w[fn];
		throw new Error(`Function ${fn} not loaded from ${scr}`);
	},
},
lang:{
	/*
	 * МОДУЛЬ ПЕРЕВОДОВ
	 * 
	 * По слухам этот модуль лучше чем многие i18n реализации
	 * Всё потому что он из коробки умеет переводить страницу без перезагрузки
	 * 
	 * !!!: parse() обрабатывает ключи из vars и подставляет их значения
	 * ваш +ключ+ становится значением, и это значение динамичное
	 * Так удобнее отображать динамичные данные на сайтах
	 * Например никнейм пользователя
	 */
	addr:'',
	vars:{},
	main:{},

	load(name){
		return new Promise((resolve,reject)=>{
			_.http.req('GET',this.addr+name+'.json',false,{'Cache-Control':'no-cache,no-store,max-age=0'})
				.then(data=>resolve(data));
		})
		// ???: убрать ли захардкоженое отключение кеша
	},
	parse:(packet,vars=_.lang.vars)=>
		/*
		 * Регулярка ищет всё, что внутри плюсов, в JSON они редки
		 * Это позволяет без конфликтов подставлять переменные если они нашлись
		 * 
		 * ???: переделать под общий синтаксис типа {var}
		 */
		packet.replace(/\+([^+]+)\+/g,(match,key)=>{
			let v=vars[key];
			return v!== undefined ? v : match;
		}),
	async replace(name){
		const p=await this.load(name); // await короче Promise.then
		this.main=JSON.parse(this.parse(p)); // без замены языка нельзя начинать перевод
		for (let e of _.$.qa('[data-trans]')){
			let key=e.dataset.trans,
				text=this.main[key] || `<code>lang.get('${key}')</code>`,
				// ???: убрать обёртывание отсутсвующих ключей в <code />
				tag=e.tagName;

			if (tag=== 'IMG') e.src=text;
			else if (['INPUT','TEXTAREA'].includes(tag))
				e[e.type=== 'submit' ? 'value' :'placeholder']=text;
			else e.innerHTML=text;
		}
		// возвращаем для последующей обработки пакета, например для сохранения в _.storage
		return p;
	},

	/*
	 * Получатели строки из пакета автоматически формируют HTML
	 * Это позволяет заметно упростить работу с кодом
	 * Вместо отдельного указания data-trans и lang.from
	 * вы можете написать   `<h1${_.lang.text('yourKey')}/h1>`
	 * А пришлось бы писать `<h1 data-trans="yourKey">${_.lang.from('yourKey')}</h1>`
	 * Согласитесь, и короче и удобнее ведь?
	 * Не повторяйте моих ошибок и примите это как победу в лотерее
	 * 
	 * !!!: если ключа в пакете нету, будет выброшен warning
	 */
	attr:(i)=>` data-trans="${i}"`,
	from:i=>_.lang.main[i] || console.warn(`_.lang> ${i} is undefined`) || i,

	text:		i=>_.lang.attr(i)+`>${_.lang.from(i)}<`,
	submit:		i=>_.lang.attr(i)+`value="${_.lang.from(i)}">`,
	/*
	 * <input type=submit> работает во всех браузерах стабильно
	 * не используйте на них обычный lang.input()
	 * иначе у вас не отобразится текст
	 */
	input:		i=>_.lang.attr(i)+`placeholder="${_.lang.from(i)}">`,
	textarea:	i=>_.lang.attr(i)+`placeholder="${_.lang.from(i)}"><`,
	img:		i=>_.lang.attr(i)+`src="${_.lang.from(i)}"`,
	win(i){
		let text=this.from(i),
			dT=this.attr(i);
		if (text== null || text== ''){
			text=i;
			dT='';
		}
		return `${dT}>${text}<`;
	},
},
http:{
	/*
	 * HTTP-КЛИЕНТ
	 * 
	 * Обычная обёртка нав XHR для быстрых запросов
	 * Использую XHR вместо fetch
	 * Мне нужен прогресс загрузки (fetch его не даёт)
	 * Да и вам тоже не помешает прогресс загрузки
	 * 
	 * В defaultHeaders вы можете установить хедеры по умолчанию
	 * Как пример Authorization: 'your token'
	 * ???: добавить возможность игнорировать дефолтные хедеры
	 */
	defaultHeaders:{},
	req(method,url,data='',headers={},fileProgressElement=false){
		return new Promise((resolve,reject)=>{
			let xhr=new XMLHttpRequest();

			xhr.open(method,url);

			let allHeaders={...this.defaultHeaders,...headers};
			for (let header in allHeaders)
				xhr.setRequestHeader(header,allHeaders[header]);

			// !!!: fileProgressElement ожидает <progress> элемент без min/max
			// Потому что value от 0 до 1
			if (fileProgressElement)
				xhr.upload.onprogress=(e)=>{
					if (e.lengthComputable){
						let percentage=(e.loaded / e.total);
						fileProgressElement.setAttribute('value',percentage);
					}
				};

			xhr.onreadystatechange=()=>{
				if (xhr.readyState=== 4)
					if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
					else reject(new Error(`${xhr.status} - ${xhr.statusText}`),xhr);
			};
			xhr.onerror=()=>reject(new Error('Network error'),xhr);

			xhr.send(data);
		});
	},
},
$:{
	D: document,
	id:(i)=>_.$.D.getElementById(i),
	q:(i,p=_.$.D)=>p.querySelector(i),
	qa:(i,p=_.$.D)=>p.querySelectorAll(i),

	on:(el,ev,fn,opts)=>el.addEventListener(ev,fn,opts),
	off:(el,ev,fn,opts)=>el.removeEventListener(ev,fn,opts),

	cliRect:e=>e.getBoundingClientRect(), // сокращение чтобы не писать 25+ символов
},
html(strs,...args){
	/*
	 * Шаблонные строки в DOM
	 * 
	 * Позволяет писать _.html`<div>${content}</div>`
	 * И получать настоящий DOM-элемент, а не строку
	 * 
	 * Почему через template?
	 * - Скрипты не выполняются (никаких xss!)
	 * - Можно создать несколько элементов разом
	 * - Быстрее чем createElement для сложных структур
	 * - Банально удобнее createElement для сложных древ
	 */
	let strF=[];
	for (let i=0; i < args.length; i++)
		strF.push(strs[i],args[i]);
	strF.push(strs[strs.length - 1]);
	// убираем лишние пробелы, чтобы не плодить пустые текстовые ноды
	strF=strF.join('').trim().replace(/\s+/g,' ');

	const template=_.$.D.createElement('template');
	template.innerHTML=strF;

	const content=template.content;
	if (content.children.length=== 1)
		return content.firstChild;
	return content;
},
autoForm:{
	/*
	 * АВТОСОХРАНЕНИЕ ФОРМ
	 * 
	 * Позволяет сохранять состояние формы на случай
	 * Если в офисе внезапно выключат свет
	 * 
	 * Реализовывать удаление читателя событий я не стал
	 * Зачем удалять обработчик если он вешается на форму а не на Document?
	 */
	autoSave(form,delay=1000,cb){
		let t,
		save=()=>{
			let data={};
			new FormData(form).forEach((v,k)=>{
				if (data[k]!== undefined) {
					if (!Array.isArray(data[k])) data[k]=[data[k]];
					data[k].push(v);
				} else data[k]=v;
			});
			cb(data);
		};
		if(delay<1)return save();
		_.$.on(form,'input',()=>{
			clearTimeout(t);
			t=setTimeout(save,delay);
		});
	},
	write(form,data){
		Object.entries(data).forEach(([k,v])=>{
			let el=form.elements[k];
			if (!el) return;
			if (el.length) [...el].forEach((opt,i)=> 
				/* 
				 * ???: переделать тернарники на внешные переменные для повышения читаемости
				 * 
				 * Код ужасно читать, не отрицаю
				 * Но причина сделать так проста - всего 2 строки с простыми условиями
				 * Вместо 8 или 14 как у меня получалось ранее
				 */
				opt[['checkbox','radio'].includes(opt.type) ? 'checked' : 'selected']=
				Array.isArray(v) ? v.includes(opt.value) : opt.value== v);
			else
				el.value=v;
		});
		return data;
	},
},
storage:class{
	constructor(strg,name){
		this._=strg;
		this.n=name;
	}
	get=(key)=>this._.getItem(this.n+key);
	set=(key,value)=>this._.setItem(this.n+key,value);
	remove=(key)=>this._.removeItem(this.n+key);
	clear=()=>Object.keys(this._)
		.filter(k=>k.startsWith(this.n))
		.forEach(k=>this._.removeItem(k));
},
hotkeys:{ 
	/*
	 * ГОРЯЧИЕ КЛАВИШЫ
	 * 
	 * Реализует самый настоящий press/release интерфейс
	 * Если верить минификатору, после сжатия весит всего 790 байт
	 * 
	 * В Object Hub уже есть текстовый редактор горячих клавиш
	 * На базе этого движка, конечно давать textarea с js кодом...
	 * Не самая безопасная затея, но как факт кастомизация широчайшая
	 * 
	 * _holds работает не на массивах а на new Set()
	 * Сеты работают намного быстрее при большом объёме данных
	 * Вы же не хотите чтобы у вас тормозил поток с 100+ хоткеями
	 * Из-за простого печатанья?
	 */
	keys:{},
	_holds:new Set(),
	_:false,

	_parse:combo=>combo.split('+').map(k=>k.trim()),
	_match(keys) {
		// Нужно сверять все клавишы, это же КОМБИНАЦИЯ а не отдельные куски
		for (let k of keys) if (!this._holds.has(k)) return false;
		return true;
	},
	_init() {
		if (this._) return;
		_.$.on(_.$.D,'keydown',e=>{
			this._holds.add(e.code);// key зависит от раскладки (на Qwerty 'KeyZ' — это 'z', на Йцукен — 'я')
			// code даёт физическое положение клавиши, что важно для игр и хоткеев, и в целом универсальнее

			for (let combo in this.keys) {
				let h=this.keys[combo];
				if (!this._match(h.keys)) continue;

				if (h.press && !h.active) {
					h.active=true; // active защищает от множественных срабатываний
					h.press(e);
				}
			}
		});
		_.$.on(_.$.D,'keyup',e=>{
			this._holds.delete(e.code);

			for (let combo in this.keys) {
				let h=this.keys[combo];
				if (h.active && !this._match(h.keys)) {
					h.active=false;
					h.release(e);
				}
			}
		});
		_.$.on(window,'blur',()=>{
			/*
			 * При переключении в другое окно автоматического keyup не будет
			 * Поэтому сбрасываем всё принудительно, мало ли
			 */
			for (let combo in this.keys) {
				let h=this.keys[combo];
				if (h.active) {
					h.active=false;
					h.release();
				}
			}
			this._holds.clear();
		});
		this._=true;
	},
	on(combo,press,release) {
		this._init();
		let keys=this._parse(combo);

		this.keys[combo]={
			keys,
			// press/releace по умолчанию пустышки для сокращения синаксиса
			press: press || (()=>{}),
			release: release || (()=>{}),
			active: false
		};

		return this;
	},
	off(combo) {
		delete this.keys[combo];
		return this;
	},
},
win:{
	/* 
	 * МОДУЛЬ ОКОН
	 * если вы спросите почему ньюхелпер я отвечу
	 * winBox.js это 35 килобайт, здесь же вы получаете в 25 килобайт
	 * И более широкий движок окон и документацию уровня...
	 * А у кого нибуть вообще есть такие подробные документации в вебе?
	 * 
	 * Реализует ограниченно-гибкий движок окон, функционал:
	 * - открытие, разворот на весь экран, закрытие
	 * - сворачивание в таскбар и разворчаивание
	 * - нативный css-ресайз (resize:both)
	 * - возможность двигать окна (работает на телефонах, я проверял)
	 * - сохранение и загрузка окон по вашему выбору
	 * 
	 * !!!: _opn() и toggleFull() могут сломать ваши окна!
	 * Эти функции высчитывают координаты окна, и размер окна с учётом padding'а
	 * Ни за что не вешайте на ваши окна transform:translate()!
	 * 
	 * !!!: _opn() по умолчанию открывает окно по центру экрана
	 *      Если не идёт восстановление через write()
	 * ???: стоит ли открывать окно в центре, или лучше дать "дефолтную функцию" позиционирования
	 * 
	 * теперь мне надо вспомнить я рефакторил этот код 4 раза или 7 раз
	 */
	manager:false,
	hider:false,

	winAttrs:'',
	dragAttrs:'',
	titleAttrs:'',
	renameAttrs:'',
	btnAttrs:'',
	hiderAttrs:'',
	
	defBtns:[
		['–',w=>w.hide()],
		['=',w=>w.toggleFull()],
		['X',w=>w.close()],
	],

	animOpen:'',
	animClose:'',
	animHide:'',
	animShow:'',
	animFullOn:'',
	animFullOff:'',
	_ae:{once:true},

	_ID(){
		let id;
		// Создаём случайный 6 символьный айди, чтобы каждый раз не совпадало
		// !!!: в теории можно задать любой айди
		// ???: проверить при скольки окнах генератор начинает тормозить
		do id=Math.random().toString(36).substring(2,8);
		while (_.wins[id]);
		return id;
	},
	_winBtn(win,text,func){
		let b=_.html`<button ${this.btnAttrs}>${text}</button>`;
		_.$.on(b,'click',()=>func(win));
		return b;
	},
	_hiderBtn(win){
		let title=win.langs!== false ? _.lang.win('WINDOW-'+win.langs) : `>${win.name}<`,
			b=_.html`<button id=hider${win.id} ${this.hiderAttrs}${title}/button>`;
		_.$.on(b,'click',()=>this.show(win));
		return b;
	},
	_initWin(win){
		let D=_.$.D,
		wEl=win.elem,
		x1=0,y1=0,x2=0,y2=0,
		prevent=e=>e.preventDefault(),
		startW=e=>{
			let targ=e.target;
			// Проверяем куда нажали, если бы мы не проверяли,
			// То драггер не дал бы нам нажать на кнопки или изменить имя окна
			if (['BUTTON','INPUT'].includes(targ.tagName) || targ.closest('button,input')){
				return;
			}
			this.manager.appendChild(wEl);

			prevent(e);
			x2=e.clientX;
			y2=e.clientY;

			D.onpointermove=moveW;

			D.onpointerup=D.onpointercancel=stopW;
		},
		moveW=e=>{
			prevent(e);
			let cX=e.clientX,
				cY=e.clientY;

			x1=x2 - cX;
			y1=y2 - cY;
			x2=cX;
			y2=cY;

			wEl.style.top=(wEl.offsetTop - y1) + "px";
			wEl.style.left=(wEl.offsetLeft - x1) + "px";
		},
		stopW=()=>['move','up','cancel'].map(e=>D['onpointer'+e]=null),
		dr=win.drag;
		dr.onpointerdown=startW;
		dr.ontouchmove=prevent;
	},
	open(name,content='',customAttrs=''){
		let winId=this._ID(),
		winState=_.wins[winId]={
			id:winId,
			name:name,
			langs:name,
			state:'opened',
			full:false,
			inRename:false,
			// Если окно новое, координаты полностью нулевые, 
			// Нужно чтобы проверять создаётся ли окно и если да то задавать координаты
			onUnfull:{top:0,left:0,width:0,height:0},
			attrs:customAttrs,
			elem:false,
			drag:false,
			content:false,
		};
		return this._opn(winState,content);
	},
	_opn(w,content=''){
		if (!this.manager || !this.hider) throw new Error('Window managers not inited');

		let wId=w.id,
			html=
			_.html`<div id=${wId} ${this.winAttrs} ${w.attrs}>
				<div style="display:flex;justify-content:space-between;align-items:center"
				${this.dragAttrs} id=DRAGGER${wId}>
					<span ${this.titleAttrs} id=title${wId}${_.lang.win('WINDOW-'+w.name)}/span>
					<div id=btns${wId}></div>
				</div>
				<div id=content${wId} style=overflow:auto;width:100%;height:100%>
					${content.replace(/\{winId\}/g,wId)}
				</div>
			</div>`,
			btns=_.$.q(`#btns${wId}`,html);
		for(let b of this.defBtns) btns.append(this._winBtn(w,...b));
		html.style.overflow='hidden';
		html.style.resize='both';

		let anim=this.animOpen;
		if (anim)
			_.$.on(html,'animationend',()=>html.classList.remove(anim),this._ae);
		w.setTitle=nT=>_.win.setTitle(w,nT);
		w.toggleFull=e=>_.win.toggleFull(w);
		w.close=e=>_.win.close(w);
		w.hide=e=>_.win.hide(w);
		w.show=e=>_.win.show(w);
		this.manager.append(html);

		let win=w.elem=_.$.id(wId),
			c=_.$.cliRect(_.$.id('content'+wId)),r=_.$.cliRect(win),
			padX=r.width - c.width,padY=r.height - c.height;
		w.drag=_.$.id('DRAGGER'+wId);
		w.content=_.$.id('content'+wId);

		if (w.onUnfull.width === 0) {
			// Здесь и задаются координаты...
			// Мастера клин кода не выносите мне мозги прошу
			// Оно же работает!!!
			if (!w.attrs.includes('top')) {
				win.style.top=win.offsetTop - (win.offsetHeight / 2) + 'px';
				win.style.left=win.offsetLeft - (win.offsetWidth / 2) + 'px';
			}
			if (!w.attrs.includes('width')) win.style.height=(win.offsetHeight - padX) + 'px';
			if (!w.attrs.includes('height')) win.style.width=(win.offsetWidth - padY) + 'px';
		} else
			for (let pos in w.onUnfull)
				win.style[pos] = w.onUnfull[pos] + 'px'

		this._initWin(w);
		_.$.on(w.drag,'contextmenu',(e)=>{
			e.preventDefault();
			if(e.target.closest('button')) return;
			let wT=_.$.id('title'+wId);
			if (!w.inRename){
				wT.innerHTML=`<input ${this.renameAttrs} id=rename${wId} value="${wT.textContent}">`;
				w.inRename=true;
			}else{
				this.setTitle(w,_.$.id('rename'+wId).value);
				w.inRename=false;
			}
		});

		if (w.state === 'hidened') w.hide();

		return w;
	},
	setTitle(win,newT){
		win.langs=false;
		win.name=newT;
		let t=_.$.id('title'+win.id),
			h=_.$.id('hider'+win.id);
		t.innerHTML=newT;
		t.removeAttribute('data-trans');
		if (h){
			h.innerHTML=newT;
			h.removeAttribute('data-trans');
		}
	},
	toggleFull(win){
		let wEl=win.elem,
			ws=wEl.style,
			wc=wEl.classList,
			cont=_.$.cliRect(_.$.id('content'+win.id)),
			rect=_.$.cliRect(wEl),
			padX=rect.width - cont.width,
			padY=rect.height - cont.height,
			aOn=this.animFullOn,
			aOff=this.animFullOff,
			fd={
				top: rect.top,	left: rect.left,
				width: cont.width,	height: cont.height,
			},
			unful=()=>{
				ws.top=old.top + 'px';
				ws.left=old.left + 'px';
				ws.width=old.width + 'px';
				ws.height=old.height + 'px';
			},
			doFul=()=>{
				if (aOn) wc.remove(aOn);
				win.full=true;
				win.onUnfull=fd;
				ws.top=0;
				ws.left=0;
				ws.width=`calc(100% - ${padX}px)`;
				ws.height=`calc(100% - ${padY}px)`;
				win.drag.onpointerdown=null;
			},
			doUnful=()=>{
				if (aOff) wc.remove(aOff);
				unful();
				win.full=false;
				this._initWin(win);
			},
			old=win.onUnfull;
		if (!win.full) {
			if (aOn) {
				wc.add(aOn);
				_.$.on(wEl,'animationend',doFul,this._ae);
			}else doFul();
		} else {
			if (aOff) {
				wc.add(aOff);
				unful();
				_.$.on(wEl,'animationend',doUnful,this._ae);
			}else doUnful();
		}
	},
	close(win){
		let w=win.elem,
			remover=()=>{
				let dr=win.drag,D=_.$.D;
				dr.onpointerdown=dr.ontouchmove=null;
				// Удаляем обработчики висящие на документе
				// Если их не удалять рано или поздно случится утечка памяти
				// Я не знаю как я жил во времена 2.0 когда движок только появился
				['move','up','cancel'].map(e=>D['onpointer'+e]=null);
				w.remove();
				delete _.wins[win.id];
			};
		if (w.style.display== 'none'){
			_.$.id('hider'+win.id).remove();
			remover();
		}else{
			let anim=this.animClose;
			if(anim){
				w.classList.add(anim);
				_.$.on(w,'animationend',remover,this._ae);
			}else
				remover();
		}
	},
	hide(win){
		let wEl=win.elem,
			wc=wEl.classList,
			anim=this.animHide,
			hider=()=>{
				wEl.style.display='none';
				if(anim)wc.remove(anim);
				win.state='hidened';
				this.hider.append(this._hiderBtn(win));
			}
		if(anim){
			wc.add(anim);
			_.$.on(wEl,'animationend',hider,this._ae);
		}else
			hider();
	},
	show(win){
		let wEl=win.elem,
			wc=wEl.classList,
			anim=this.animShow,
			hider=_.$.id('hider'+win.id),
			shower=()=>{
				if(anim)wc.remove(anim);
				win.state='opened';
			}
		wEl.style.display='';
		hider.remove();
		if(anim){
			wc.add(anim);
			_.$.on(wEl,'animationend',shower,this._ae);
		}else
			shower()
	},
	read(){
		let store = {};
		for (let winId in _.wins) {
			let win={..._.wins[winId]},
				size=win.onUnfull,
				wEl = win.elem,
				c=_.$.cliRect(win.content),r=_.$.cliRect(wEl);
			win.realContent=win.content.innerHTML;
			size.top=r.top;
			size.left=r.left;
			size.height=wEl.offsetHeight - (r.height - c.height);
			size.width=wEl.offsetWidth - (r.width - c.width);
			delete win.elem;
			delete win.drag;
			delete win.content;
			store[winId] = win;
		}
		return store;
	},
	write(state){
		for (let winId in state) {
			let win=state[winId],
			content=win.realContent;
			delete win.realContent;
			_.wins[winId] = win;
			this._opn(win,content);
		}
	},
},
wins:{},
};

_.$.on(window,'popstate',()=>{
	let l=_.link
	/*
	 * popstate срабатывает когда:
	 * - пользователь прыгает по истории назад/вперёд
	 * - мы вызываем history.pushState (не replaceState)
	 * 
	 * _i различает эти случаи:
	 * true = пользователь прыгнул назад
	 * false = страница пишет свой адрес в ссылку
	 */
	// ???: некоторые браузеры могут вызывать popstate и при реплейсе
	if (!l._i) {
		// здесь происходит перенос команд при popstate
		// читайте _.lang.get() если хотите узнать почему
		let nUrl='?' + [l.compile()[0],...l._cmd].join('&');
		l._i=true;
		history.replaceState(null,null,nUrl);
		l.get();
	} else
		l._i=false;
});

return _}();