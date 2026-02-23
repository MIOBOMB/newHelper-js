_={};
_.ver='2.1';
_.link={
	basePage:()=>{},
	defTitle:'',
	actions:{},
	commands:{},
	_cmd:[],

	_i: true,
	compile:()=>location.search.replace('?','').split('&'),
	set(page,title=_.link.defTitle){
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
		let cfg=_.link,
			links=this.compile(),
			[fKey,fVal]=links[0].split('='),
			cmds=links.slice(1);
		try {
			let dirs=fKey.split('/'),
				dir=cfg.actions,
				main=dir[fKey];
			if (!fKey.includes('/')){
				main(fVal);
			} else {
				for (let p of dirs){
					let kDir=dir[p+'/'];
					if (kDir)
						dir=kDir;
					else{
						dir[p](fVal);
						break;
					}
				}
			}
		}catch(e){
			_.link.basePage();
			throw e;
		}
		_.link._cmd=cmds;
		cmds.forEach(kPre=>{
			let [key,val]=kPre.split('=');
			let cmd=cfg.commands[key];
			if (cmd)
				cmd(val);
		});
	},
};
_.lazy={
	loaded:{},
	load(url,...args){
		let key=url.split('?')[0],
			state=this.loaded,
			c=state[key];

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
			window[fn]=(...a)=>_.lazy._(scr,fn).then(f=>f(...a));

		console.info('_.lazy> Applied lazy '+scr+' with this functions:',funcs);
	},
	async _(scr,fn){
		let w=window,
			wrpr=w[fn];
		try{await _.lazy.load(scr)}
		catch(e){throw e}
		if (wrpr!== w[fn]) return w[fn];
		throw new Error(`Function ${fn} not loaded from ${scr}`);
	},
};
_.lang={
	addr:'',
	vars:{},
	main:{},

	_:(i)=>` data-trans="${i}"`,
	load(name){
		return new Promise((resolve,reject)=>{
			_.http.req('GET',_.lang.addr+name+'.json',false,{'Cache-Control':'no-cache,no-store,max-age=0'})
				.then(data=>resolve(data));
		})
	},
	parse:(packet,vars=_.lang.vars)=>
		packet.replace(/\+([^+]+)\+/g,(match,key)=>{
			let v=vars[key];
			return v!== undefined ? v : match;
		}),
	async replace(name){
		const p=await this.load(name);
		_.lang.main=JSON.parse(this.parse(p));
		for (let e of _.$.qa('[data-trans]')){
			let key=e.dataset.trans,
				text=_.lang.main[key] || `<code>_.lang.get('${key}')</code>`,
				tag=e.tagName;

			if (tag=== 'IMG') e.src=text;
			else if (['INPUT','TEXTAREA'].includes(tag))
				e[e.type=== 'submit' ? 'value' :'placeholder']=text;
			else e.innerHTML=text;
		}
		return p;
	},
	from:i=>_.lang.main[i] || console.warn(`_.lang> ${i} is undefined`) || i,

	text:		i=>_.lang._(i)+`>${_.lang.from(i)}<`,
	submit:		i=>_.lang._(i)+`value="${_.lang.from(i)}">`,
	input:		i=>_.lang._(i)+`placeholder="${_.lang.from(i)}">`,
	textarea:	i=>_.lang._(i)+`placeholder="${_.lang.from(i)}"><`,
	img:		i=>_.lang._(i)+`src="${_.lang.from(i)}"`,
	win(i){
		let text=_.lang.from(i),
			dT=_.lang._(i);
		if (text== null || text== ''){
			text=i;
			dT='';
		}
		return `${dT}>${text}<`;
	},
};
_.http={
	defaultHeaders:{},
	req(method,url,data='',headers={},fileProgressElement=false){
		return new Promise((resolve,reject)=>{
			let xhr=new XMLHttpRequest();

			xhr.open(method,url);

			let allHeaders={..._.http.defaultHeaders,...headers};
			for (let header in allHeaders)
				xhr.setRequestHeader(header,allHeaders[header]);

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
};
_.$={
	D: document,

	id:(i)=>_.$.D.getElementById(i),
	q:(i,p=_.$.D)=>p.querySelector(i),
	qa:(i,p=_.$.D)=>p.querySelectorAll(i),

	on:(el,ev,fn,opts)=>el.addEventListener(ev,fn,opts),
	off:(el,ev,fn,opts)=>el.removeEventListener(ev,fn,opts),
};
_.html=(strs,...args)=>{
	let strF=[];
	for (let i=0; i < args.length; i++)
		strF.push(strs[i],args[i]);
	strF.push(strs[strs.length - 1]);
	strF=strF.join('').trim().replace(/\s+/g,' ');

	const template=_.$.D.createElement('template');
	template.innerHTML=strF;

	const content=template.content;
	if (content.children.length=== 1)
		return content.firstChild;
	return content;
};
_.storage=class{
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
};
_.err={
	print:()=>{},

	errors:{},
	_c: 0,
	log(err){
		_.err.print(_.err._c,err);
		_.err._c++;
		_.err.errors[_.err._c]=err;
	},
	handleGlobal(message,source,line,column,error){
		console.error(message,source+':'+line+':'+column,error)
		_.err.log(message+`\n IN ${source} ON LINE ${line} IN COLUMN ${column}`);
	},
	handleRejection(e){
		const err=e.reason || e;
		console.error(err);
		_.err.log(
			`PROMISE ERROR\n`+
			`${e.stack || e}`
		);
	},
};
_.hotkeys={
	keys:{},
	_holds:new Set(),
	_:false,

	_parse:combo=>combo.split('+').map(k=>k.trim()),
	_match(keys) {
		for (let k of keys) if (!this._holds.has(k)) return false;
		return true;
	},
	_init() {
		if (this._) return;
		_.$.on(_.$.D,'keydown',e=>{
			this._holds.add(e.code);

			for (let combo in this.keys) {
				let h=this.keys[combo];
				if (!this._match(h.keys)) continue;

				if (h.press && !h.active) {
					h.active=true;
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
			press: press || (()=>{}),
			release: release || (()=>{}),
			active: false
		};

		return this;
	},
	off(combo) {
		delete this.keys[combo];
		return this;
	}
};
_.win={
	manager:false,
	hider:false,

	winAttrs:'',
	dragAttrs:'',
	titleAttrs:'',
	renameAttrs:'',
	btnAttrs:'',
	hiderAttrs:'',
	
	defBtns:[
		['–',w=>_.win.hide(w)],
		['=',w=>_.win.toggleFull(w)],
		['X',w=>_.win.close(w)],
	],

	animOpen:'',
	animClose:'',
	animHide:'',
	animShow:'',
	animFullOn:'',
	animFullOff:'',

	_ID(){
		let id;
		do id=Math.random().toString(36).substring(2,8);
		while (_.wins[id]);
		return id;
	},
	_winBtn(win,text,func){
		let b=_.html`<button ${_.win.btnAttrs}>${text}</button>`;
		_.$.on(b,'click',()=>func(win));
		return b;
	},
	_hiderBtn(win){
		let title=win.langs!== false ? _.lang.win('WINDOW-'+win.langs) : `>${win.name}<`,
			b=_.html`<button id=hider${win.id} ${_.win.hiderAttrs}${title}/button>`;
		_.$.on(b,'click',()=>_.win.show(win));
		return b;
	},
	_initWin(win){
		let wEl=win.elem,
			x1=0,y1=0,x2=0,y2=0,
		startW=e=>{
			let targ=e.target;
			if (['BUTTON','INPUT'].includes(targ.tagName) || targ.closest('button,input')){
				return;
			}
			_.win.manager.appendChild(wEl);

			e.preventDefault();
			x2=e.clientX || e.touches[0].clientX;
			y2=e.clientY || e.touches[0].clientY;

			_.$.D.onmouseup=_.$.D.ontouchend=stopW;

			_.$.D.onmousemove=_.$.D.ontouchmove=moveW;
		},
		moveW=e=>{
			e.preventDefault();
			let cX=e.clientX || e.touches[0].clientX,
				cY=e.clientY || e.touches[0].clientY;

			x1=x2 - cX;
			y1=y2 - cY;
			x2=cX;
			y2=cY;

			wEl.style.top=(wEl.offsetTop - y1) + "px";
			wEl.style.left=(wEl.offsetLeft - x1) + "px";
		},
		stopW=()=>{
			['mouseup','touchend','mousemove','touchmove']
			.forEach(e=>_.$.D['on'+e]=null)
		},
		drag=win.drag;
		drag.onmousedown=drag.ontouchstart=startW;
	},
	open(name,content='',customAttrs=''){
		if (!_.win.manager || !_.win.hider)
			throw new Error('Window managers not inited');
		let winId=_.win._ID();
		_.wins[winId]={};
		let s=_.wins[winId];
		s.id=winId;
		s.name=name;
		s.langs=name;
		s.state='opened';
		s.full=false;
		s.inRename=false;
		s.onUnfull={top:0,left:0,width:0,height:0,};
		
		s.setTitle = newTitle=>_.win.setTitle(s,newTitle);
		s.toggleFull = e=>_.win.toggleFull(s);
		s.close = e=>_.win.close(s);
		s.hide = e=>_.win.hide(s);
		s.show = e=>_.win.show(s);

		let html =
			_.html`<div id=${winId} ${_.win.winAttrs} ${customAttrs}>
				<div style="display:flex;justify-content:space-between;align-items:center"
				${_.win.dragAttrs} id=DRAGGER${winId}>
					<span ${_.win.titleAttrs} id=title${winId}${_.lang.win('WINDOW-'+name)}/span>
					<div id=btns${winId}></div>
				</div>
				<div id=content${winId} style=overflow:auto;width:100%;height:100%>
					${content.replace(/\{winId\}/g,winId)}
				</div>
			</div>`,
			btns=_.$.q(`#btns${winId}`,html);
		for(let b of _.win.defBtns) btns.append(_.win._winBtn(s,...b));

		html.style.overflow='hidden';
		html.style.resize='both';

		let anim=_.win.animOpen;
		if (anim)
			_.$.on(html,'animationend',()=>html.classList.remove(anim),{ once: true })
		_.win.manager.append(html);

		let win=s.elem=_.$.id(winId),
			c=_.$.id('content'+winId).getBoundingClientRect(), r=win.getBoundingClientRect(),
			padX=r.width - c.width, padY=r.height - c.height;
		s.drag=_.$.id('DRAGGER'+winId);
		s.content=_.$.id('content'+winId);

		if (!customAttrs.includes('top')) {
			win.style.top=win.offsetTop - (win.offsetHeight / 2) + 'px';
			win.style.left=win.offsetLeft - (win.offsetWidth / 2) + 'px';
		}
		if (!customAttrs.includes('width')) win.style.height=(win.offsetHeight - padX) + 'px';
		if (!customAttrs.includes('height')) win.style.width=(win.offsetWidth - padY) + 'px';

		_.$.on(s.drag,'dblclick',(e)=>{
			if(e.target.closest('button')) return;
			let wT=_.$.id('title'+winId);
			if (!s.inRename){
				wT.innerHTML=`<input ${_.win.renameAttrs} id=rename${winId} value="${wT.textContent}">`;
				s.inRename=true;
			}else{
				_.win.setTitle(s,_.$.id('rename'+winId).value);
				s.inRename=false;
			}
		});

		_.win._initWin(s);

		return s;
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
			cont=_.$.id('content'+win.id).getBoundingClientRect(),
			rect=wEl.getBoundingClientRect(),
			padX=rect.width - cont.width,
			padY=rect.height - cont.height,
			aOn=_.win.animFullOn,
			aOff=_.win.animFullOff,
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
				win.drag.onmousedown=null;
				win.drag.ontouchstart=null;
			},
			doUnful=()=>{
				if (aOff) wc.remove(aOff);
				unful();
				win.full=false;
				_.win._initWin(win);
			},
			old=win.onUnfull;
		if (!win.full) {
			if (aOn) {
				wc.add(aOn);
				_.$.on(wEl,'animationend',doFul,{ once: true });
			}else doFul();
		} else {
			if (aOff) {
				wc.add(aOff);
				unful();
				_.$.on(wEl,'animationend',doUnful,{ once: true });
			}else doUnful();
		}
	},
	close(win){
		let w=win.elem,
			remover=()=>{
				let drag=win.drag;
				drag.onmousedown=null;
				drag.ontouchstart=null;
				w.remove();
				delete _.wins[win.id];
			};
		if (w.style.display== 'none'){
			_.$.id('hider'+win.id).remove();
			remover();
		}else{
			let anim=_.win.animClose;
			if(anim){
				w.classList.add(anim);
				_.$.on(w,'animationend',remover,{ once: true });
			}else
				remover();
		}
	},
	hide(win){
		let wEl = win.elem,
			wc=wEl.classList,
			anim=_.win.animHide,
			hider=()=>{
				wEl.style.display='none';
				if(anim)wc.remove(anim);
				win.state='hidened';
				_.win.hider.append(_.win._hiderBtn(win));
			}
		if(anim){
			wc.add(anim);
			_.$.on(wEl,'animationend',hider,{ once: true });
		}else
			hider();
	},
	show(win){
		let wEl = win.elem,
			wc=wEl.classList,
			anim=_.win.animShow,
			hider=_.$.id('hider'+win.id),
			shower=()=>{
				if(anim)wc.remove(anim);
				win.state='opened';
			}
		wEl.style.display='';
		hider.remove();
		if(anim){
			wc.add(anim);
			_.$.on(wEl,'animationend',shower,{ once: true });
		}else
			shower()
	},
};
_.wins={};

_.$.on(window,'error',_.err.handleGlobal);
_.$.on(window,'unhandledrejection',_.err.handleRejection);
_.$.on(window,'popstate',()=>{
	let l=_.link
	if (!l._i) {
		let nUrl='?' + [l.compile()[0],...l._cmd].join('&');
		history.replaceState(null,null,nUrl);
		l._i=true;
		l.get();
	} else
		l._i=false;
});
