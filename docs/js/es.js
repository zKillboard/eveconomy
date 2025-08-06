let server_started = null;

const default_item_id = 44992;
const default_region_id = null;
const modification_indication_delay_insert = 300;
const modification_indication_delay_modify = 300;
const modification_indication_delay_remove= 5;

document.addEventListener('DOMContentLoaded', exec);
document.getElementById('searchbox').addEventListener('input', doSearch);
document.getElementById('itemparent').addEventListener('click', stopCollapseToggleWhenSearching);
document.getElementById('btnorders').addEventListener('click', showOrders);
document.getElementById('btnsearch').addEventListener('click', showSearch);

window.addEventListener("popstate", exec);

const searchArray = [];
const searchArrayMap = {};
let searchCharsMinimum = 4;

function searchOverride() {
	searchCharsMinimum--;
	document.getElementById('searchCharsMinimum').innerHTML = `${searchCharsMinimum} `;
	doSearch();
}
document.getElementById('searchOverride').addEventListener('click', searchOverride);
searchOverride();

let groupsLoaded = false;
function loadMarketGroups() {
	if (groupsLoaded == false) {
		groupsLoaded = true;
		doGetJSON(`/api/groups.json`, parseGroups);
		console.log('Loading groups');
	}
}

function parseGroups(data) {
	let itemdiv = document.getElementById('items');
	addGroups(itemdiv, data, 0);
}

function addGroups(parent, data, depth) {
	if (typeof data == 'undefined') return;
	let keys = Object.keys(data).sort();
	for (let key of keys) {
		let group = data[key];

		let forid = 'subgroup' + group.id;
		let div = createElement('div', undefined, {classes: 'mlist'})
		let anchor = createElement('a', key, {classes: 'btn btn-sm btn-default groupname', for: forid, href: '#subgroup' + group.id, role: 'button', 'aria-expanded': false});
		anchor.onclick = anchorClick;
		let subgroup = createElement('div', undefined, {id: forid, classes: 'hideit subgroup'});

		div.appendChild(anchor);
		div.appendChild(subgroup);
		parent.appendChild(div);

		setTimeout(function() { addGroups(subgroup, group.subgroups, depth + 1) }, 1);
		
		if (Object.keys(group.items).length > 0) {
			let ul = createElement('ul');
			for (let itemName of Object.keys(group.items).sort()) {
				let item = group.items[itemName];
				let itemNameL = itemName.toLowerCase();

				let li = createElement('li', undefined, {item_id: item.item_id, itemname: itemNameL, classes: 'itemname'});
				li.onclick = litem;
				let anchor = createElement('a', item.name, {item_id: item.item_id, href: '/item/' + item.item_id});
				anchor.onclick = litem;
				li.appendChild(anchor);
				ul.appendChild(li);
				
				searchArray.push(itemNameL);
				searchArrayMap[itemNameL] = li;
			}
			subgroup.appendChild(ul);
		}
	}
}

function anchorClick() {
	let forid = this.getAttribute('for');
	let child = document.getElementById(forid);

	if (child.classList.contains('hideit')) {
		child.classList.remove('hideit');
		this.setAttribute('aria-expanded', 'true');
	}
	else {
		child.classList.add('hideit');
		this.setAttribute('aria-expanded', 'false');
	}
	
	return false;
}

function doSearch() {
	const text = document.getElementById('searchbox').value.toLowerCase();
	let matches = Object.values(document.getElementsByClassName('match'));
	let noncollapsing = document.querySelectorAll('.groupname[data-bs-toggle="non-collapsing"]');
	let itemparent = document.getElementById('itemparent');

	[...matches].map((li) => li.classList.remove('match'));
	[...noncollapsing].map((nc) => nc.setAttribute('data-bs-toggle', 'collapse'));
	elementsDisplay('#searchMin', false);
	elementsDisplay('#search0Reults', false);

	if (text.length == 0) {
		itemparent.classList.remove('searching');
	} else {
		itemparent.classList.add('searching');

		if (text.length < searchCharsMinimum) {
			elementsDisplay('#searchMin', true);
		} else {
			let exact = searchArray.filter(element => element == text);
			if (exact.length == 1) pushLiItem(searchArrayMap[text]);

			let matches = searchArray.filter(element => element.includes(text));
			if (matches.length == 0) return elementsDisplay('#search0Reults', true);

			[...matches].map((t) => itemMatch(searchArrayMap[t]));

			noncollapsing = document.querySelectorAll('.searching .match > .groupname');
			// [...noncollapsing].map((nc) => nc.setAttribute('data-bs-toggle', 'non-collapsing'));

			if (exact.length == 1) {
				itemparent.scrollTo(0, searchArrayMap[text].offsetTop - 100);
			}
		}
	}
}

function elementsDisplay(selector, display) {
	[...document.querySelectorAll(selector)].map((e) => e.classList[display ? 'remove' : 'add']('d-none'));
}

function itemMatch(elem) {
	do {		
		elem.classList.add('match');
		elem = elem.parentNode;
	} while (elem.getAttribute('id') != 'items');
}

function stopCollapseToggleWhenSearching(event) {
	let isSearching = document.getElementById('itemparent').classList.contains('searching');
	if (isSearching) {
		event.preventDefault();
		event.stopPropagation();
		return false;
	}
	return true;
}

function litem(e) {
	e.stopPropagation();
	e.preventDefault();

	return pushLiItem(this);
}

function pushLiItem(li) {
	let url = '/item/' + li.getAttribute('item_id');
	window.history.pushState({path: url},'', url);
	setTimeout(exec, 1);
	setTimeout(showOrders, 1);
	return false;
}

function exec() {
	setTimeout(keyCleanup, 0);
	setTimeout(updateTime, 0);
	setTimeout(updateTqStatus, 0);
	loadRegions();
	loadStructures();

	const path = window.location.pathname;
	const split = path.split('/');
	
	switch(split[1]) {
	case 'item':
		loadItem(split[2]);
		break;
	default:
		console.log('unknown or invalid path, defaulting to 44992');
		loadItem(44992);
	}
}

function getTime() {
	const nowUTC = new Date();
	return nowUTC.getUTCHours().toString().padStart(2, '0') + ':' + nowUTC.getUTCMinutes().toString().padStart(2, '0') + ' UTC';
}

function updateTime() {
	document.getElementById('utcClock').innerHTML = getTime();
	let seconds = new Date().getUTCSeconds();
	setTimeout(updateTime, 1000 * (60 - seconds));
}

function updateTqStatus() {
	doGetJSON('https://esi.evetech.net/status/', setTqStatus);
}

let tqstatusid = -1;
function setTqStatus(data) {
	try {
		if (data == null || data.players == null) return;
		const tqStatus = document.getElementById('tqStatus');
		if (data.players >= 500) {
			tqStatus.innerHTML = ' TQ ONLINE';
			tqStatus.classList.add('online');
			tqStatus.classList.remove('offline');
		} else {
			tqStatus.innerHTML = ' TQ OFFLINE';
			tqStatus.classList.remove('online');
			tqStatus.classList.add('offline');
		}
	} finally {
		const nowUTC = new Date();
		let seconds = nowUTC.getUTCSeconds();
		clearTimeout(tqstatusid);
		tqstatus = setTimeout(updateTqStatus, 1000 * (60 - seconds));
	}
}

function keyCleanup() {
	// cleanup keys if necesary
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (localStorage.getItem(key) == "false") localStorage.removeItem(key);
	}
}

function scheduleRemoval(element, timeout_seconds = 1) {
	setTimeout(() => { element.remove(); }, (timeout_seconds * 1000) + 1);
}

let regions = null;
function loadRegions() {
	if (regions == null) doGetJSON(`https://esi.evetech.net/universe/regions`, saveRegions);
}

function saveRegions(data) {
	regions = data;
	console.log('Regions loaded');
}

let structures = null;
function loadStructures() {
	if (structures == null) doGetJSON(`/structures.json`, saveStructures);
}

function saveStructures(data) {
	structures = data;
	console.log('Structures Loaded');
	for (const [id, name] of Object.entries(data)) {
		localStorage.setItem(`${id}`, name)
	}
}

let current_item_timeout = -1;
let current_item_id = null;
let current_region_id = null;
let current_load_item = null;
function loadItem(item_id, region_id = null, refresh = false) {
	if (regions === null) return setTimeout(loadItem.bind(null, item_id, region_id), 1);
	clearTimeout(current_item_timeout);
	if (current_item_id != item_id) doGetJSON(`https://esi.evetech.net/universe/types/${item_id}/?datasource=tranquility&language=en`, populateInfo);	

	console.log('Loading item', item_id, region_id, refresh);
	item_id = parseInt(item_id);
	let check_regions = regions;
	if (item_id == 44992) check_regions = [19000001];
	else if (region_id != null) check_regions = [parseInt(region_id)];
	
	region_id = region_id ? parseInt(region_id) : null;

	current_item_id = item_id;
	current_region_id = region_id;

	if (refresh == false) {
		const selldiv = document.querySelector('.orders[of="sell"]');
		const buydiv = document.querySelector('.orders[of="buy"]');
		selldiv.innerHTML = '';
		buydiv.innerHTML = '';
	} else {
		document.querySelectorAll('.modified').forEach(el => { el.classList.remove('modified')});
		document.querySelectorAll('.inserted').forEach(el => { el.classList.remove('inserted')});
	}
	
	let now = Math.floor(Date.parse(new Date().toISOString()) / 1000);
	check_regions.forEach((region_id) => doGetJSON(`https://esi.evetech.net/markets/${region_id}/orders/?datasource=tranquility&order_type=all&page=1&&type_id=${item_id}`, populateOrders, {page: 1, now: now, refresh: refresh}))
	setTimeout(loadMarketGroups, 250);
	if (refresh) setTimeout(removeOrders.bind(null, now), 250);
	fetchLocations();
	current_item_timeout = setTimeout(loadItem.bind(null, item_id, region_id, true), 301000);
}

function populateOrders(data, path, params) {
	let now = params.now;

	let sell = document.createElement('div');
	let buy = document.createElement('div');
	data.forEach((o) => {
		if (modifyOrder(now, o) == false && o.min_volume == 1) { // min_volume = 1 just because anything else is probably some sort of scam
			let ohtml = createOrder(now, o, params.refresh);
			if (o.is_buy_order) buy.append(ohtml);
			else sell.append(ohtml);
		}
	})
	
	let selldiv = document.querySelector('.orders[of="sell"]');
	selldiv.innerHTML = selldiv.innerHTML + sell.innerHTML;

	let buydiv = document.querySelector('.orders[of="buy"]');
	buydiv.innerHTML = buydiv.innerHTML + buy.innerHTML;

	sort(document.querySelector('.orders[of="sell"]'));
	sort(document.querySelector('.orders[of="buy"]'));

	// Do we have another page?
	if (data.length >= 1000) {
		let page = params.page + 1;
		let item_id = data[0].type_id;
		doGetJSON(`https://esi.evetech.net/markets/${region_id}/orders/?datasource=tranquility&order_type=all&${page}=1&&type_id=${item_id}`, populateOrders, {page: page, now: params.now});
	}
}

function populateInfo(data) {
	document.getElementById('itemimg').setAttribute('src', `https://images.evetech.net/types/${data.type_id}/icon?size=128`);
	document.getElementById('itemname').innerHTML = data.name;
	document.title = data.name + ' - EVEconomy';
}

function fetchLocations() {
	let needs_fetching = document.querySelectorAll('span[fetch_location="true"]');
	needs_fetching.forEach(el => fetchLocation(el));
	if (inflight > 0) setTimeout(fetchLocations, 100);
}

function fetchLocation(el) {
	const location_id = parseInt(el.getAttribute('location_id'));
	if (parseInt(location_id) <= 69999999) {
		const path = `https://esi.evetech.net/universe/stations/${location_id}/?datasource=tranquility`;
		updateNameById(path, el, location_id, false);
	} else {
		if (structures[location_id] != null) {
			el.textContent = structures[location_id];
			el.removeAttribute('fetch_location');	
			return;
		}
		const system_id = parseInt(el.getAttribute('system_id'));
		const path = `https://esi.evetech.net/universe/systems/${system_id}/?datasource=tranquility&language=en`;
		updateNameById(path, el, location_id, true);
	}
}

function updateNameById(path, el, location_id, structure) {
	let data = localStorage.getItem(`${location_id}`);
	if (data == null) {
			localStorage.setItem(`${location_id}`, "false")
			doGetJSON(path, (data) => { saveName(location_id, data, structure); }, { id: location_id });
	} else if (data !== "false") {
		el.textContent = data;
		el.removeAttribute('fetch_location');	
	}
}

function saveName(location_id, data, structure) {
	localStorage.setItem(`${location_id}`, data.name + (structure == true ? ' Structure' : ''));
}

const ORDERSHEAD = `
	<span class='text-end'>Remaining</span>
		<span class='text-end'>Price</span>
		<span field='location_name'>Location</span>
		<span class='text-end'>Range</span>`;
const columns = {
	'volume_remain': {field: 'volume_remain', format: 'int', classes: 'text-end'},
	'price': {field: 'price', format: 'dec', classes: 'text-end'},
	'location_name': {field: 'location_name', location: true},
	'range': {field: 'range', classes: 'text-end capitalize'},
};

function createOrder(now, order, refresh = false) {
	if (order.volume_remain == 0) return;
	try {
		let pdiv = createElement('div', undefined, {classes: 'order', oid: order.order_id, price: Math.floor(order.price * 100)});
		pdiv.setAttribute('last_modified', now);
		for (let column of Object.keys(columns)) {
			let val = order[column];
			if (columns[column]['format']) val = getValueFormatted(val, columns[column]['format']);
			
			let span = createElement('span', val, columns[column]);
			if (column == 'location_name') {
				span.setAttribute('location_id', order.location_id);
				span.setAttribute('system_id', order.system_id);
				
				let name = localStorage.getItem(`${order.location_id}`);
				if (name != null && name != 'false') span.innerHTML = name;
				else span.setAttribute('fetch_location', true);
			}
			pdiv.appendChild(span);
		}

		if (refresh == true) pdiv.classList.add('inserted');

		return pdiv;
	} catch (e) {
		console.error(order, e);
	}
}

function modifyOrder(now, order) {
	const order_id = order.order_id;
	let el = document.querySelector(`.order[oid="${order_id}"]`);
	
	if (el == null) return false;
	el.setAttribute('last_modified', now);
	let children = el.children;

	let volume_remain = getValueFormatted(order.volume_remain, 'int');
	let span_vr = children[0];
	if (volume_remain != span_vr.innerHTML) {
		span_vr.innerHTML = volume_remain;
		span_vr.classList.add('modified');
		console.log('modified', order_id, 'remain', volume_remain);
	}

	let span_price = children[1];
	let price = getValueFormatted(order.price, 'dec');
	if (price != span_price.innerHTML) {
		el.setAttribute('price', Math.floor(order.price * 100));
		span_price.innerHTML = price;
		span_price.classList.add('modified');
		console.log('modified', order_id, 'price', price);
	}
}

function removeOrders(now) {
	if (inflight > 0) return setTimeout(removeOrders.bind(null, now), 250);
	let goodbye = document.querySelectorAll(`.order:not([last_modified="${now}"])`);

	goodbye.forEach(order => {
		let order_id = order.getAttribute('oid');
		
		order.classList.remove('inserted');
		order.classList.remove('modified');
		order.classList.add('remove');

		let span_vr = document.querySelector(`.order[oid="${order_id}"] span[field="volume_remain"]`);
		span_vr.innerHTML = 0;			

		setTimeout(() => { order.remove(); }, modification_indication_delay_remove * 1000);
	});
}

function createElement(element, content = '', attributes = {}) {
	let e = document.createElement(element);
	if (content) e.innerHTML = content;
	for (let attr of Object.keys(attributes)) e.setAttribute((attr == 'classes' ? 'class' : attr), attributes[attr]);
	return e;
}

let keyCleanupID = -1;
let inflight = 0;
function doGetJSON(path, f, params = {}) {
	console.log(getTime(), 'fetching', path);
	const xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (xhr.readyState === 4 && xhr.status < 400) f(JSON.parse(xhr.responseText), path, params);
		else if (xhr.readyState == 4) {
			console.log(xhr.status, path);
			clearTimeout(keyCleanupID);
			keyCleanupID = setTimeout(keyCleanup, 1000); // remove "false" from localStorage
		}
	};
	xhr.onloadend  = function() { 
		inflight--;
		if (inflight == 0) document.getElementById('inflight_spinner').classList.add('d-none');
	};
	xhr.open('GET', path);
	xhr.send();
	inflight++;
	document.getElementById('inflight_spinner').classList.remove('d-none');
}

const formats = {
	int: 0,
	dec: 2
}
function getValueFormatted(value, format) {
	let n = ('' + value).length > 10 ? BigInt(value) : Number(value);
	let dec = formats[format];
	return n.toLocaleString(undefined, {minimumFractionDigits: dec, maximumFractionDigits: dec});
}

function showOrders() {
	document.getElementById('panelsearch').classList.add('xs-hideit');
	document.getElementById('panelorders').classList.remove('xs-hideit');
}

function showSearch() {
	document.getElementById('panelsearch').classList.remove('xs-hideit');
	document.getElementById('panelorders').classList.add('xs-hideit');
}

function sort(parent) {
  let children = parent.children;

  children = Array.from(children);
  children = children.sort((a, b) => {
  	let price_compare = parseInt(a.getAttribute('price')) - parseInt(b.getAttribute('price'));
    
    if (price_compare != 0) return price_compare;

    return parseInt(b.getAttribute('oid')) - parseInt(a.getAttribute('oid'));
  });
  children.forEach((child, index) => child.style.order = index);
}