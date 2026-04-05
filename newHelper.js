
/*
 * Перед вами код newHelper.js версии 2.1.6, он построен на базе фабрики
 * Которая начинается с Intl.newHelper=function(){...};
 * Причина использоватся Intl.newHelper банально проста
 * Если я сейчас засираю глобалскоуп одной полу гибкой переменной
 * То почему бы не начать отказываться от засирания глобал скоупа как такового
 * И да, для инициализации ньюхелпера реально нужно писать
 * yourVariable = Intl.newHelper()
 * 
 * Стиль комментариев
 * FIXME - странное поведение функции, которое желательно бы переделать
 * ??? - требует уточнения
 * !!! - обратите внимание
 * See also - почитайте для понимания как устроено
 * 
 * ???: рассмотреть переход на es6 экспорт вместо вкладывания фабрики в Intl
 * 
 * Новые модули, готовятсяк релизу в 2.2
 * их апи может быть чуть чуть нестабильно:
 * tables - на стадии рефакторинга
 * form
 * drag (портирован из окон)
 * pipe/pipeAsync
 * В 2.2 появятся плагины, некоторые модули ядра будут вынесены в плагины:
 * win (в 2.2)
 * tables (возможно он не будет частью ядра, но с другой стороны он полезен в админках)
 * http (в 2.3)
 *
 * Модули, имена которых зарезервированы на 2.3++
 * не используйте их неймспейсы для плагинов:
 * toast
 * filezone
 * ikarus
 *
 * Плагины, новый паттерн который я хочу узаконить в 2.2
 * Это не _.use(), не _.plugins, не мутация прототипа
 * Простое назначение _.myPlugin = pluginFabric();
 * (где _ это уже вызванная фабрика ядра)
 * Как предполагается работать? также как и Intl.newHelper()
 * Фабрика плагина возвращает объект, метод, или класс, или что вам нужно
 * Вам для подключения плагина просто нужно дать плагину неймспейс внутри ядра
 * И вызвать фабрику, всё!
 */

Intl.newHelper=function() {let _ = {
    link: {
    	/*
    	 * МОДУЛЬ ССЫЛОК
    	 * 
    	 * Работает по принципу [ссылка, команды...]
    	 * Пример: ?home&debug&lang=ru
    	 *          ^^^^ ^^^^^^^^^^^^^
    	 *      страница команды
    	 * 
    	 * В процессе разработки ядра 2.0 в Object hub я понял
    	 * Что команды могут быть очень полезными для отладки
    	 * Но в теории на них можно повешать все модальные и прочие действия
    	 * 
    	 * !!!: в функции get() работает весь роутинг, в т.ч. вложенный для страниц
       	 *
    	 * See also:
         * - https://developer.mozilla.org/en-US/docs/Web/API/History_API
    	 */
    	basePage: ()=>{},
    	defTitle: '',
    	actions: {},
    	commands: {},

    	_i: true, // _i - блокировщик pushState в set()
        _pop() {
        	/*
             * Popstate движок
             *
             * Сделан он для сохранения команд в истории
             * Это уникальная фича newHelper.js
             *
    	     * popstate срабатывает когда:
        	 * - пользователь прыгает по истории назад/вперёд
        	 * - мы вызываем history.pushState (не replaceState)
    	     * 
        	 * _i различает эти случаи:
        	 * true = пользователь прыгнул назад
    	     * false = страница пишет свой адрес в ссылку
        	 */
        	// ???: некоторые браузеры могут вызывать popstate и при реплейсе
    	    if (!this._i) {
    		    // здесь происходит перенос команд при popstate
        		// читайте _.link.get() если хотите узнать почему
        		let newUrl='?' + [this.compile()[0],...this._cmd].join('&');
    	    	this._i=true;
    		    history.replaceState(null,null,newUrl);
        		this.get();
        	} else
    	    	this._i=false;
        }, 
    	_cmd: [],
        _popInit: false,
        _init() {
            if (!this._popInit) {
                window.addEventListener('popstate', ()=>this._pop());
                this._popInit = true;
            }
        },

    	compile: ()=>location.search.replace('?','').split('&'),
    	set(page, title = this.defTitle) {
    		if (title) document.title = title;
    		if (!this._i) {
    			let link = this.compile();
    			link[0] = page;
    			history.pushState(null,null,'?'+link.join('&'));
    		}
    		this._i = false;
    	},
    	add(cmd) {
    		let link = this.compile();
    		if (!link.includes(cmd)) {
    			link.push(cmd);
    			this._cmd.push(cmd);
    			history.replaceState(null,null,'?'+link.join('&'));
    		}
    	},
    	remove(cmd) {
    		let link = this.compile();
    		if (link.includes(cmd)){
    			let c = this._cmd;
    			link.splice(link.indexOf(cmd),1);
    			c.splice(c.indexOf(cmd),1);
    			history.replaceState(null,null,'?'+link.join('&'));
    		}
    	},
    	get() {
            this._init();
    		/*
    		 * Страницы бросают ошибку чтобы вызвать базовую страницу
    		 * Команды тем временем так не делают
    		 * Потому что сломанная команда не так страшна как сломанная страница
    		 * 
    		 * При popstate команды берутся из хранилища _cmd, вместо самой ссылки
    		 * Сделано это для переноса команд при прыжках по истории
    		 */
    		let links = this.compile(),
    			[ firstKey, fisrtValue ] = links[0].split('='),
    			cmds = links.slice(1);
    		try {
    			let dirs = firstKey.split('/'),
    				dir = this.actions,
    				main = dir[firstKey];
    			if (!firstKey.includes('/')) {
    				main(fisrtValue);
    			} else {
    				for (let p of dirs){
    					let kDir = dir[p+'/'];
    					if (kDir)
    						dir = kDir;
    					else{
    						dir[p](fisrtValue);
    						break;
    					}
    				}
    			}
    		} catch (e) {
    			this.basePage();
    			throw e;
    		}
    		this._cmd = cmds;
    		cmds.forEach(cmdPre => {
    			let [ key, value ] = cmdPre.split('=');
    			let cmd = this.commands[key];
    			if (cmd)
    				cmd(value);
    			else 
    				console.error(new Error(`command '${cmd}' doesn't exist!`))
    		});
    	},
    },
    lazy: {
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
    	 *
    	 * See also: 
    	 * - https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/Window/window
    	 * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function (для lazy())
    	 */
    	loaded: {},
    	load(url, ...args) {
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
    		let key = url.split('?')[0], // отсекаем параметры, чтобы не дублировать
    			state = this.loaded;
    		if (state[key] === true)
    			return Promise.resolve(args);
    		if (state[key] instanceof Promise)
    			return state[key].then(()=>args);
    
    		let promise = new Promise((resolve,reject)=>{
    			let scr = document.createElement('script');
    			scr.src = url;
    			scr.onload = ()=>{
    				state[key] = true;
    				resolve(args);
    			};
    			scr.onerror = ()=>{
    				delete state[key];
    				reject(new Error('Failed to load '+url));
    			};
    			document.head.append(scr);
    		});
    		state[key] = promise;
    		return promise;
    	},
    	register(script, funcs) {
    		if (!Array.isArray(funcs))
    			return new Error('Array required for register');
    
    		for (let fn of funcs) {
    			let fns = fn.split('.'),
    				method = fns.pop(),
    				path = window;
    			for (let obj of fns) {
    				if (path[obj] == undefined)
    					path[obj] = {};
    				path = path[obj];
    			}
    			path[method] = (...a)=>
    				this.lazy(script,fn).then(f=>f(...a));
    		}
    	},
    	async lazy(scr, fn) {
    		let get = path => path.split('.').reduce((obj, key) => obj?.[key], window),
    			wrapper = get(fn);
    
    		await this.load(scr); // await короче Promise.then
    
    		if (wrapper !== get(fn))
    			return get(fn);
    		throw new Error(`Function ${fn} not loaded from ${scr}`);
    	},
    },
    lang: {
    	/*
    	 * МОДУЛЬ ПЕРЕВОДОВ (l10n)
    	 * 
    	 * По слухам этот модуль лучше чем многие i18n реализации, и лучше всех l10n
    	 * Всё потому что он из коробки умеет переводить страницу без перезагрузки
    	 * 
    	 * !!!: parse() обрабатывает ключи из vars и подставляет их значения
    	 *      ваш +ключ+ становится значением, и это значение динамичное
    	 *      Так удобнее отображать динамичные данные на сайтах
    	 *      Например никнейм пользователя
    	 *
    	 * !!!: Это l10n (локализация), а не i18n (интернационализация)
    	 *
    	 *      i18n — подготовка кода: вынос строк в JSON, поддержка Unicode,
    	 *      гибкая верстка. Делается один раз.
    	 * 
    	 *      l10n - перевод JSON и адаптация под язык/регион
    	 * 
    	 *      lang - загружает JSON, подставляет +переменные+,
    	 *      даёт реактивную смену языка на странице
    	 *
    	 *      Чтобы частично приблизить lang к i18n используйте Intl,
    	 *      Нативное апи интернационализации (даты, числа, валюты)
    	 *
    	 * See also:
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
    	 * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset (data-trans атрибуты)
    	 * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl
    	 * - https://localizejs.com/articles/i18n-vs-l10n
    	 */
    	addr: '',
    	vars: {},
    	// FIXME: переделать main на мапу т.к. внутреннее api?
    	//        или сохранить оригинальное api на объекте
    	main: {},
    
    	load: name => _.http.req('GET', _.lang.addr + name + '.json'),
    	parse: (packet, vars = _.lang.vars)=>
    		// ???: переделать под общий синтаксис типа {var}
    		packet.replace(/\+([^+]+)\+/g, (match, key)=>{
    			let v = vars[key];
    			return v !== undefined ? v : match;
    		}),
    	async replace(name){
    		const packet = await this.load(name);
    		this.main = JSON.parse(this.parse(packet)); // без замены языка нельзя начинать перевод
    
    		for (let el of document.querySelectorAll('[data-trans]')) {
    			let key = el.dataset.trans,
    				text = this.main[key] || key,
    				tag = el.tagName;
    
    			if (tag === 'IMG')
    				el.src = text;
    			else if (['INPUT','TEXTAREA'].includes(tag))
    				el[ el.type === 'submit' ? 'value' : 'placeholder' ] = text;
    			else
    				el.innerHTML = text;
    		}
    		// возвращаем для последующей обработки пакета, например для сохранения в _.storage
    		return packet;
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
    	attr:		i=>` data-trans="${i}"`,
    	from:		i=>_.lang.main[i] || console.warn(`_.lang> ${i} is undefined`) || i,
    
    	text:		i=>_.lang.attr(i)+`>${_.lang.from(i)}<`,
    	submit:		i=>_.lang.attr(i)+`value="${_.lang.from(i)}">`, // <input type=submit>
    	input:		i=>_.lang.attr(i)+`placeholder="${_.lang.from(i)}">`,
    	textarea:	i=>_.lang.attr(i)+`placeholder="${_.lang.from(i)}"><`,
    	img:		i=>_.lang.attr(i)+`src="${_.lang.from(i)}"`,
    	winTitle(i) {
    		let text = this.from(i),
    			dataTrans = this.attr(i);
    		if (text == null || text == '') {
    			text = i;
    			dataTrans = '';
    		}
    		return `${dataTrans}>${text}<`;
    	},
    },
    http: {
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
    	 *
    	 * See also:
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
    	 * - https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/progress
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
    	 */
    	defaultHeaders: {},
    	req(method, url, data = '', headers = {}, fileProgressElement = false) {
    		return new Promise((resolve, reject)=>{
    			let xhr = new XMLHttpRequest();
    
    			xhr.open(method, url);
    
    			let allHeaders = { ...this.defaultHeaders, ...headers };
    			for (let header in allHeaders)
    				xhr.setRequestHeader(header, allHeaders[header]);
    
    			// !!!: fileProgressElement ожидает <progress> элемент без min/max
    			// Потому что value от 0 до 1
    			if (fileProgressElement)
    				xhr.upload.onprogress= e=>{
    					if (e.lengthComputable) {
    						let percentage = (e.loaded / e.total);
    						fileProgressElement.setAttribute('value', percentage);
    					}
    				};
    
    			xhr.onreadystatechange= ()=>{
    				if (xhr.readyState=== 4)
    					if (xhr.status >= 200 && xhr.status < 300)
    						resolve(xhr.response);
    					else 
    						reject(new Error(`${xhr.status} - ${xhr.statusText}`),xhr);
    			};
    			xhr.onerror = ()=>
    				reject(new Error('Network error'), xhr);
    
    			xhr.send(data);
    		});
    	},
    	get: (url, headers={})=>
    		_.http.req('GET', url, false, headers),
    	post: (url, data = '', headers = {}, fileProgressElement = false)=>
    		_.http.req('POST', url, data, headers, fileProgressElement)
    },
    html(strs, ...args) {
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
    	 *
    	 * See also:
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/HTMLTemplateElement
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/Document/createTreeWalker
    	 */
    	let fullStr = '',
    		DOMs = [];
    	for (let i=0; i < args.length; i++) {
    		fullStr += strs[i];
    		let arg = args[i];
    		if (arg && arg.nodeType) {
                fullStr += `<!--${DOMs.length}-->`;
                DOMs.push(arg);
    		} else {
                fullStr += arg;
    		}
    	}
        fullStr += strs[strs.length - 1];
    
    	const template = document.createElement('template');
    	template.innerHTML = fullStr;
    	const content = template.content;
    
    	// для создания вложенности html элементов заменяем плейсхолдеры <!--${DOMs.length}-->
    	const it = document.createTreeWalker(
    		content,
    		NodeFilter.SHOW_COMMENT
    	);
    	let node, i = 0;
    	for (; node = it.nextNode(); )
    		node.replaceWith(DOMs[i++]);
    
    	if (content.children.length === 1)
    		return content.firstChild;
    	return content;
    },
    pipe(data, ...fns) {
    	/*
    	 * КАСТОМНЫЙ PIPE ОПЕРАТОР
    	 * 
    	 * Никакой магии, обычный синхронный |>
    	 * для мутации таблиц будет самое то
    	 *
    	 * See also:
    	 * - https://github.com/tc39/proposal-pipeline-operator/blob/main/README.md
    	 */
    	for (const fn of fns)
    		data = fn(data);
    	return data;
    },
    async pipeAsync(data, ...fns) {
    	/*
    	 * КАСТОМНЫЙ PIPE ОПЕРАТОР 2
    	 * 
    	 * Никакой магии, обычный асинхронный |>
    	 * для получения и мутации данных сойдёт
    	 *
    	 * See also:
    	 * - https://github.com/tc39/proposal-pipeline-operator/blob/main/README.md
    	 * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function
    	 */
    	for (const fn of fns) {
    		let waiter = await data;
    		data = await fn(waiter);
    	}
    	return data;
    },
    form: {
    	/*
    	 * АВТОСОХРАНЕНИЕ ФОРМ
    	 * 
    	 * Позволяет сохранять состояние формы на случай
    	 * Если в офисе внезапно выключат свет
    	 * 
    	 * ???: может сделать более полноценный модуль форм
    	 *      с встроенной валидацией, или чем нибуть ещё
    	 *
    	 * See also:
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/FormData/FormData
    	 * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
    	 */
    	read(form) {
    		let data = {};
    		new FormData(form).forEach((value, key)=>{
    			if (data[key] !== undefined) {
    				if (!Array.isArray(data[key]))
    					data[key] = [data[key]];
    				else 
    					data[key].push(value);
    			} else
    				data[key] = value;
    		});
    		return data;
    	},
    	write(form, data) {
    		Object.entries(data).forEach(([key,value])=>{
    			let el = form.elements[key];
    			if (!el)
    				return;
    			if (el.length)
    				[...el].forEach((opt,i)=>{
    					let isCheckBox = 'selected';
    					if (['checkbox','radio'].includes(opt.type))
    						isCheckBox = 'checked';
    
    					let select = false;
    					if (Array.isArray(value)) {
    						if (value.includes(opt.value))
    							select = true;
    					} else if (opt.value == value)
    						select = true;
    
    					opt[isCheckBox] = select;
    				});
    			else
    				el.value = value;
    		});
    		return data;
    	},
    },
    tables(elem, name, columns, raw, rowKey = 'ID') {
    	/*
    	 * МОДУЛЬ АВТОТАБЛИЦ
    	 * 
    	 * Позволяет быстро генерировать таблицы с особыми свойствами
    	 * 
    	 * !!!: в columns параметр mutate работает как парсер значения
    	 * !!!: сортируйте сами путём мутации data, javascript как никак умеет
    	 *      или вообще сортируйте на сервере
    	 * 
    	 * ???: рассмотреть переделку апи т.к. в текущей реализации
         * гибкость все ещё слишком низкая
    	 */
    	if (!Array.isArray(raw))
    		raw = Object.values(raw);
    	let state = {
    		name: name,
    		columns: columns,
    		raw: raw,
    		rowKey: rowKey,
    		data: raw,
    		elem: elem,
    
    		render() {
    			let html = '';
    			html += `<thead><tr>`;
    			for (let c of this.columns)
    				html += `<th>${c.title || c.key}</th>`;
    			html += `</tr></thead>`;
    
    			html += `<tbody>`;
    			for (let row of this.data) {
    				let id = row[this.rowKey];
    
    				html += `<tr data-id="${id}">`;

    				for (let c of this.columns) {
    					let v = row[c.key];
    					if (c.mutate)
    						v = c.mutate(row);
    					html += `<td>${v ?? ``}</td>`;
    				}
    				html += `</tr>`;
    			}
    			html += `</tbody>`;
    
    			this.elem.innerHTML = `<table>${html}</table>`;
    		}
    	};
    	return state;
    },
    storage: class {
    	// See also:
    	// - https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
    	// - https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage
    	// - https://developer.mozilla.org/en-US/docs/Web/API/Storage
    	constructor(storage, name) {
    		this._ = storage;
    		this.n = name;
    	}
    	get = key=>			this._.getItem(this.n + key);
    	set = (key, value)=>this._.setItem(this.n + key, value);
    	remove = key=>		this._.removeItem(this.n + key);
    	clear = ()=>Object.keys(this._)
    		.filter(k => k.startsWith(this.n))
    			.forEach(k => this._.removeItem(k));
    },
    err: {
    	//See also:
    	// - https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event
    	// - https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event
    	// - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    	init() {
    		window.addEventListener('error',_.err.handleGlobal);
    		window.addEventListener('unhandledrejection',_.err.handleRejection);
    	},
    	print: (cnt,e)=>console.error(e),
    
    	errors: {},
    	_c: 0,
    	log(err) {
    		_.err.print(_.err._c,err);
    		_.err._c++;
    		_.err.errors[_.err._c]=err;
    	},
    	handleGlobal(message,source,line,column,error){
    		console.error(message,source+':'+line+':'+column,error)
    		_.err.log(message + `\n IN ${source} ON LINE ${line} IN COLUMN ${column}`);
    	},
    	handleRejection(e){
    		const err = e.reason || e;
    		console.error(err);
    		_.err.log(
    			`PROMISE ERROR\n`+
    			`${e.stack || e}`
    		);
    	},
    },
    hotkeys: {
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
    	 *
    	 * FIXME: Рассмотреть альтернативы e.code из-за проблем
    	 *        с otg-клавиатурами на телефонах
    	 *
    	 * See also:
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/Element/keyup_event
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/Element/blur_event
    	 * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
    	 * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
    	 */
    	keys: new Map(),
    	_holds: new Set(),
    	_: false,
    
    	_parse: combo => combo.split('+').map(k=>k.trim()),
    	_match(keys) {
    		// Нужно сверять все клавишы, это же КОМБИНАЦИЯ а не отдельные куски
    		for (let k of keys) if (!this._holds.has(k)) return false;
    		return true;
    	},
    	_init() {
    		if (this._)
    			return;
    		document.addEventListener('keydown', e=>{
    			this._holds.add(e.code);// key зависит от раскладки (на Qwerty 'KeyZ' — это 'z', на Йцукен — 'я')
    			// code даёт физическое положение клавиши, что важно для игр и хоткеев, и в целом универсальнее
    
    			for (let hotkey of this.keys.values()) {
    				if (!this._match(hotkey.keys))
    					continue;
    				if (hotkey.press && !hotkey.active) {
    					hotkey.active = true; // active защищает от множественных срабатываний
    					hotkey.press(e);
    				}
    			}
    		});
    		document.addEventListener('keyup', e=>{
    			this._holds.delete(e.code);
    
    			for (let hotkey of this.keys.values()) {
    				if (hotkey.active && !this._match(hotkey.keys)) {
    					hotkey.active=false;
    					hotkey.release(e);
    				}
    			}
    		});
    		window.addEventListener('blur', e=>{
    			/*
    			 * При переключении в другое окно автоматического keyup не будет
    			 * Поэтому сбрасываем всё принудительно, мало ли
    			 */
    			for (let hotkey of this.keys.values()) {
    				if (hotkey.active) {
    					hotkey.active = false;
    					hotkey.release();
    				}
    			}
    			this._holds.clear();
    		});
    		this._=true;
    	},
    	on(combo, press, release) {
    		this._init();
    		let keys = this._parse(combo);
    
    		this.keys.set(combo, {
    			keys,
    			// press/releace по умолчанию пустышки для сокращения синаксиса
    			press: press || (()=>{}),
    			release: release || (()=>{}),
    			active: false
    		});
    
    		return this;
    	},
    	off(combo) {
    		this.keys.delete(combo);
    		return this;
    	},
    },
    drag: {
    	// See also:
    	// - https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientX
    	// - https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientY
    	// - https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
    	// - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
    	// - https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault
    	// - https://developer.mozilla.org/en-US/docs/Web/API/Element/touchmove_event (почему нам нужен preventDefault)
    	_i: false,
    	active: new Map(),

        prevent: e=>e.target.closest('button,input'),
    	init(dragger, mover, onStart, onStop) {
    		let start=e=>{
    			// Проверяем куда нажали, если бы мы не проверяли,
    			// То драггер не дал бы нам нажать на кнопки или изменить имя окна
    			if (this.prevent(e)) return;
    
                e.preventDefault();
    
    			this.active.set(e.pointerId,{
    				x:e.clientX,
    				y:e.clientY,
    				mover:mover,
    				onStop:onStop
    			});
    
    			onStart?.(e);
    		};
    		if (!this._i) {
    			document.addEventListener("pointermove", (e) => this.move(e));
    			document.addEventListener("pointerup", (e) => this.stop(e));
    			document.addEventListener("pointercancel", (e) => this.stop(e));
    			this._i = true;
    		}
    		dragger.onpointerdown=start;
    		// превентим touchmove событие чтобы не было проблем
    		// при скролле на телефонах
    		dragger.ontouchmove=e=>e.preventDefault();
        },
    	move(e) {
    		let p=this.active.get(e.pointerId);
    		if(!p) return;
            e.preventDefault();
    
    		let dx=p.x - e.clientX,
    			dy=p.y - e.clientY;
    
    		p.x=e.clientX;
    		p.y=e.clientY;
    
    		let mov = p.mover;
    		mov.style.top=(mov.offsetTop - dy)+"px";
    		mov.style.left=(mov.offsetLeft - dx)+"px";
    	},
    	stop(e) {
    		this.active.get(e.pointerId)?.onStop?.(e);
    		this.active.delete(e.pointerId);
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
    	 * теперь мне надо вспомнить я рефакторил этот код 4 раза или 7 раз
    	 *
    	 * !!!: _opn() и toggleFull() могут сломать ваши окна!
    	 *      Эти функции высчитывают координаты окна, и размер окна с учётом padding'а
    	 *      Ни за что не вешайте на ваши окна transform:translate()!
    	 * 
    	 * !!!: _opn() по умолчанию открывает окно по центру экрана
    	 *      Если не идёт восстановление через write()
    	 *
    	 * ???: стоит ли открывать окно в центре, или лучше дать "дефолтную функцию" позиционирования
    	 *
    	 * FIXME: вынести lang.winTitle из переводов для устранения "связности" кода
    	 * 
    	 * See also:
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect
    	 * - https://developer.mozilla.org/en-US/docs/Web/CSS/position
    	 * - https://developer.mozilla.org/en-US/docs/Web/CSS/resize
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/Element/animationend_event
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event
    	 * - https://developer.mozilla.org/en-US/docs/Web/API/Element/classList
    	 * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
    	 * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures
    	 * - html модуль
    	 * - lang.winTitle функция
    	 * - drag модуль
    	 */
    	manager:false,
    	hider:false,
    	text:'',
    
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
    
        _animate(elem, anim, actAfter = ()=>{}, actPre = ()=>{}) {
    		if (anim) {
    			elem.classList.add(anim);
                actPre();
    			elem.addEventListener('animationend', ()=>{
    			    elem.classList.remove(anim);
                    actAfter();
                }, { once: true });
    		} else {
    			actPre();
                actAfter();
            }
        },
    	_ID(){
    		let id;
    		// Создаём случайный 6 символьный айди, чтобы каждый раз не совпадало
    		// !!!: в теории можно задать любой айди
    		// ???: проверить при скольки окнах генератор начинает тормозить
    		do id=Math.random().toString(36).substring(2,8);
    		while (_.wins.has(id));
    		return id;
    	},
    	_winBtn(win,text,func){
    		let b=_.html`<button ${this.btnAttrs}>${text}</button>`;
    		b.addEventListener('click',()=>func(win));
    		return b;
    	},
    	_hiderBtn(win){
    		let title=win.langs!== false ? _.lang.winTitle(_.win.text+win.langs) : `>${win.name}<`,
    			b=_.html`<button id=hider${win.id} ${this.hiderAttrs}${title}/button>`;
    		b.addEventListener('click',()=>this.show(win));
    		return b;
    	},
    	_initWin: winState=>
    		_.drag.init(winState.drag, winState.elem, ()=>_.win.manager.appendChild(winState.elem)),
    	open(name,content='',customAttrs=''){
    		let winId=this._ID(),
    		winState={
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
    	_opn(winState,content=''){
    		if (!this.manager || !this.hider) throw new Error('Window managers not inited');
    
    		let wId=winState.id,
    			html=
    			_.html`<div id=${wId} ${this.winAttrs} ${winState.attrs}>
    				<div style="display:flex;justify-content:space-between;align-items:center"
    				${this.dragAttrs} id=DRAGGER${wId}>
    					<span ${this.titleAttrs} id=title${wId}${_.lang.winTitle(_.win.text+winState.name)}/span>
    					<div id=btns${wId}></div>
    				</div>
    				<div id=content${wId} style=overflow:auto;width:100%;height:100%>
    					${content.replace(/\{winId\}/g,wId)}
    				</div>
    			</div>`,
    			btns=html.querySelector(`#btns${wId}`);
    		for(let b of this.defBtns) btns.append(this._winBtn(winState,...b));
    		html.style.overflow='hidden';
    		html.style.resize='both';
    
            this._animate(html, this.animOpen)

    		winState.setTitle=nT=>_.win.setTitle(winState,nT);
    		winState.toggleFull=e=>_.win.toggleFull(winState);
    		winState.close=e=>_.win.close(winState);
    		winState.hide=e=>_.win.hide(winState);
    		winState.show=e=>_.win.show(winState);
    		this.manager.append(html);
    
    		let win=winState.elem=document.getElementById(wId),
    			contentRect=document.getElementById('content'+wId).getBoundingClientRect(),
    			windowRect=win.getBoundingClientRect(),
    			padX=windowRect.width - contentRect.width,padY=windowRect.height - contentRect.height;
    		winState.drag=document.getElementById('DRAGGER'+wId);
    		winState.content=document.getElementById('content'+wId);
    
    		if (winState.onUnfull.width === 0) {
    			// Здесь и задаются координаты...
    			// Мастера клин кода не выносите мне мозги прошу
    			// Оно же работает!!!
    			if (!winState.attrs.includes('top')) {
    				win.style.top=win.offsetTop - (win.offsetHeight / 2) + 'px';
    				win.style.left=win.offsetLeft - (win.offsetWidth / 2) + 'px';
    			}
    			if (!winState.attrs.includes('width')) win.style.height=(win.offsetHeight - padX) + 'px';
    			if (!winState.attrs.includes('height')) win.style.width=(win.offsetWidth - padY) + 'px';
    		} else
    			for (let pos in winState.onUnfull)
    				win.style[pos] = winState.onUnfull[pos] + 'px'
    
    		this._initWin(winState);
    		winState.drag.addEventListener('contextmenu',(e)=>{
    			e.preventDefault();
    			if(e.target.closest('button')) return;
    			let wT=document.getElementById('title'+wId);
    			if (!winState.inRename){
    				wT.innerHTML=`<input ${this.renameAttrs} id=rename${wId} value="${wT.textContent}">`;
    				winState.inRename=true;
    			}else{
    				this.setTitle(winState,document.getElementById('rename'+wId).value);
    				winState.inRename=false;
    			}
    		});
    
    		if (winState.state === 'hidened') winState.hide();
    
    		_.wins.set(winState.id, winState);
    		return winState;
    	},
    	setTitle(winState,newT){
    		winState.langs=false;
    		winState.name=newT;
    		let t=document.getElementById('title'+winState.id),
    			h=document.getElementById('hider'+winState.id);
    		t.innerHTML=newT;
    		t.removeAttribute('data-trans');
    		if (h){
    			h.innerHTML=newT;
    			h.removeAttribute('data-trans');
    		}
    	},
    	toggleFull(winState){
    		let wEl=winState.elem,
    			ws=wEl.style,
    			wc=wEl.classList,
    			contentRect=document.getElementById('content'+winState.id).getBoundingClientRect(),
    			windowRect=wEl.getBoundingClientRect(),
    			padX=windowRect.width - contentRect.width,
    			padY=windowRect.height - contentRect.height,
    			aOn=this.animFullOn,
    			aOff=this.animFullOff,
    			fd={
    				top: windowRect.top,	left: windowRect.left,
    				width: contentRect.width,	height: contentRect.height,
    			},
    			unful=()=>{
    				ws.top=old.top + 'px';
    				ws.left=old.left + 'px';
    				ws.width=old.width + 'px';
    				ws.height=old.height + 'px';
    			},
    			doFul=()=>{
    				if (aOn) wc.remove(aOn);
    				winState.full=true;
    				winState.onUnfull=fd;
    				ws.top=0;
    				ws.left=0;
    				ws.width=`calc(100% - ${padX}px)`;
    				ws.height=`calc(100% - ${padY}px)`;
    				winState.drag.onpointerdown=null;
    			},
    			doUnful=()=>{
    				if (aOff) wc.remove(aOff);
    				unful();
    				winState.full=false;
    				this._initWin(winState);
    			},
    			old=winState.onUnfull;
    		if (!winState.full)
                this._animate(wEl, this.animFullOn, doFul)
    		else
                this._animate(wEl, this.animFullOff, doUnful, unful)
    	},
    	close(winState){
    		let w=winState.elem,
    			remover=()=>{
    				let dr=winState.drag,D=document;
    				dr.onpointerdown=dr.ontouchmove=null;
    				// Удаляем обработчики висящие на документе
    				// Если их не удалять рано или поздно случится утечка памяти
    				// Я не знаю как я жил во времена 2.0 когда движок только появился
    				['move','up','cancel'].map(e=>D['onpointer'+e]=null);
    				w.remove();
    				_.wins.delete(winState.id);
    			};
    		if (w.style.display== 'none') {
    			document.getElementById('hider'+winState.id).remove();
    			remover();
            } else
                this._animate(w, this.animClose, remover);
    		
    	},
    	hide(winState){
    		let wEl=winState.elem,
    			wc=wEl.classList,
    			anim=this.animHide,
    			hider=()=>{
    				wEl.style.display='none';
    				if(anim)wc.remove(anim);
    				winState.state='hidened';
    				this.hider.append(this._hiderBtn(winState));
    			}
            this._animate(wEl, this.animHide, hider);
    	},
    	show(winState){
    		let wEl=winState.elem,
    			wc=wEl.classList,
    			anim=this.animShow,
    			hider=document.getElementById('hider'+winState.id),
    			shower=()=>{
    				if(anim)wc.remove(anim);
    				winState.state='opened';
    			}
    		wEl.style.display='';
    		hider.remove();
            this._animate(wEl, this.animShow, shower);
    	},
    	/*
    	 * о да, ниже идёт самая крутая фишка которую я готовлю к 2.2
    	 * 
    	 * СОХРАНЕНИЕ-ВОССТАНОВКА ОКОН
    	 * Помните автоформы? Здесь я поступил лучше
    	 * Вы можете полностью сохранить окна, как - решаете вы, но лучше
    	 * Вместо колбека я теперь просто делаю разовый читатель, так намного гибче
    	 * Плюсом я делаю разовый восстановитель который возвращает все окна
    	 * Так тоже в разы гибче, авось у вас в окнах были вебсокеты и их нужно восстановить
    	 * Проще записать результат а потом прогнать проверку по data-ws атрибутам
    	 * Или как вы ещё придумаете
    	 * 
    	 * !!!: Оно работает настолько гибко что в теории можно сделать виртуальные рабочие столы
    	 */
    	read(){
    		let store = {};
    		for (let [winId, winPre] of _.wins) {
    			let win = { ...winPre },
    				size=win.onUnfull,
    				wEl = win.elem,
    				contentRect=win.content.getBoundingClientRect(),
    				windowRect=wEl.getBoundingClientRect();
    			win.realContent=win.content.innerHTML;
    			size.top=windowRect.top;
    			size.left=windowRect.left;
    			size.height=wEl.offsetHeight - (windowRect.height - contentRect.height);
    			size.width=wEl.offsetWidth - (windowRect.width - contentRect.width);
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
    			_.wins.set(winId, win);
    			this._opn(win,content);
    		}
    		return _.wins;
    	},
    },
    wins: new Map(),
    };
    
    return _
};
