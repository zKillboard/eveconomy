let server_started = null;

const default_item_id = 44992;
const default_region_id = null;
const modification_indication_delay_insert = 300;
const modification_indication_delay_modify = 300;
const modification_indication_delay_remove= 1;

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
		let epoch = Math.floor(Date.now() / 1000);
		epoch = epoch - (epoch % 900);
		doGetJSON(`/api/groups?epoch=${epoch}`, parseGroups);
		groupsLoaded = true;
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

		let div = createElement('div', undefined, {classes: 'mlist'})
		let anchor = createElement('a', key, {classes: 'btn btn-sm btn-default groupname', 'data-bs-toggle': 'collapse', href: '#subgroup' + group.id, role: 'button', 'aria-expanded': false});
		let subgroup = createElement('div', undefined, {id: 'subgroup' + group.id, classes: 'collapse subgroup'});

		div.appendChild(anchor);
		div.appendChild(subgroup);
		parent.appendChild(div);

		setTimeout(function() { addGroups(subgroup, group.subgroups, depth + 1) }, 1);
		
		if (Object.keys(group.items).length > 0) {
			let ul = createElement('ul');
			for (let itemName of Object.keys(group.items).sort()) {
				let item = group.items[itemName];
				itemNameL = itemName.toLowerCase();

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
			[...noncollapsing].map((nc) => nc.setAttribute('data-bs-toggle', 'non-collapsing'));

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

function toggleChildren(e) {
	e.stopPropagation();
	let market_id = this.getAttribute('market_id');
	console.log(market_id)
	let show = (this.getAttribute('aria-expanded') == "true" ? false : true);
	for (let child of this.children) {
		if (show) child.classList.remove('d-none');
		else child.classList.add('d-none');
	}
	this.setAttribute('aria-expanded', show);
	return false;
}

let ws = null;
function exec() {
	wsConnect();

	const path = window.location.pathname;
	const split = path.split('/');
	
	switch(split[1]) {
	case 'item':
		loadItem(split[2]);
		break;
	default:
		console.log('unknown path execution');
	}
}

function wsMessage(event) {
	try {
		let data = JSON.parse(event.data);
		let do_sort = false;

		if (data.action == 'insert') {
			let order_parent;
			if (data.order.is_buy_order) {
				order_parent = document.querySelector('.orders[of="buy"]');
			} else {
				order_parent = document.querySelector('.orders[of="sell"]');
			}

			let odiv = createOrder(data.order);
			odiv.classList.add('insert');
			order_parent.appendChild(odiv);
			scheduleClass(odiv, 'insert', modification_indication_delay_insert);
			console.log('inserted', data.order.order_id);
			do_sort = true;
		} else if (data.action == 'modify') {
			let order_id = data.order.order_id;
			let order = document.querySelector(`.order[oid="${order_id}"]`);
			if (order) {
				let volume_remain = getValueFormatted(data.order.volume_remain, 'int');
				let span_vr = document.querySelector(`.order[oid="${order_id}"] span[field="volume_remain"]`);
				if (volume_remain != span_vr.innerHTML) {
					scheduleClass(span_vr, 'flash', .5);
					span_vr.innerHTML = volume_remain;
				}
				let span_price = document.querySelector(`.order[oid="${order_id}"] span[field="price"]`);
				let price = getValueFormatted(data.order.price, 'dec');
				if (price != span_price.innerHTML) {
					scheduleClass(span_price, 'flash', .5);
					scheduleClass(span_price, 'modify', modification_indication_delay_modify);
					order.setAttribute('price', Math.floor(data.order.price * 100));
					span_price.innerHTML = price;
					do_sort = true;
				}
				console.log('modified', data.order.order_id);
			}
		} else if (data.action == 'remove') {
			console.log(data);
			let order_id = data.order_id;
			let order = document.querySelector(`.order[oid="${order_id}"]`);
			if (order) {
				scheduleClass(order, 'remove', modification_indication_delay_remove);
				scheduleRemoval(order, modification_indication_delay_remove);
				console.log('removed', order_id);
			}
		} else if (data.action == 'refresh') window.location = window.location;
		else if (data.action == 'started') {
			// See if the server has restarted recently
			if (server_started == null) server_started = data.started;
			else if (server_started != data.server_started) window.location = window.location;
		}
		else {console.error('unknown action', data)};

		if (do_sort) {
			sort(document.querySelector('.orders[of="sell"]'));
			sort(document.querySelector('.orders[of="buy"]'));
		}
	} catch (e) {
		console.log(e);
	}
}

function scheduleClass(element, className, timeout_seconds = 4) {
	element.classList.add(className);
	setTimeout(() => { element.classList.remove(className); }, (timeout_seconds * 1000));
	return element;
}

function scheduleRemoval(element, timeout_seconds = 1) {
	setTimeout(() => { element.remove(); }, (timeout_seconds * 1000) + 1);
}


async function wsConnect() {
	if (ws == null) {
		ws = new ReconnectingWebSocket(websocket_url);
		ws.onopen = wsOpen;
	}	
}

async function wsOpen() {
	console.log('websocket connected');
	ws.onmessage = wsMessage;
}

let channel_subs = new Set();
async function wsSub(channel, attempts = 1) {
    try {
    	if (attempts > 100) return;

    	if (channel_subs.has(channel)) return; // console.log('already subbed to ', channel);
    	channel_subs.add(channel);

        ws.send(JSON.stringify({'action':'sub', 'channel': channel}));
        console.log("subscribing to", channel, attempts);
    } catch (e) {
        setTimeout(() => wsSub(channel, ++attempts), 10 * attempts);
    }
}

async function wsUnsub(channel, attempts = 1) {
    try {
    	if (attempts > 100) return;

    	if (!channel_subs.has(channel)) return; // console.log('not subbed to ', channel);
    	channel_subs.delete(channel);

        console.log("unsubscribing from ", channel, attempts);
        ws.send(JSON.stringify({'action':'unsub', 'channel': channel}));
    } catch (e) {
    	console.log(e);
        setTimeout(() => wsUnsub(channel, ++attempts), 10 * attempts);
    }
}

let current_item_id = null;
let current_region_id = null;
async function loadItem(item_id, region_id = null) {
	item_id = parseInt(item_id);
	region_id = region_id ? parseInt(region_id) : null;

	if (current_item_id !== item_id) {
		wsUnsub(`market:item:${current_item_id}:region:${current_region_id}`);
		wsUnsub(`market:item:${current_item_id}`);
		wsUnsub(`market:region:${current_region_id}`);

		current_item_id = item_id;
		current_region_id = region_id;

		doGetJSON(`/api/info?id=${item_id}&type=item_id`, populateInfo);	
		if (region_id != null) doGetJSON(`/api/orders?item=${item_id}&region_id=${region_id}`, populateOrders);
		else doGetJSON(`/api/orders?item=${item_id}`, populateOrders);
	}
}

function populateOrders(data) {
	document.getElementById('itemimg').setAttribute('src', `https://images.evetech.net/types/${data.id}/icon?size=128`);
	assembleColumns('buyorders', data.buy, "buy");
	assembleColumns('sellorders', data.sell, "sell");

	if (current_region_id != null) wsSub(`market:item:${current_item_id}:region:${current_region_id}`);
	else wsSub(`market:item:${current_item_id}`);

	sort(document.querySelector('.orders[of="sell"]'));
	sort(document.querySelector('.orders[of="buy"]'));

	loadMarketGroups();
}

function populateInfo(data) {
	document.getElementById('itemname').innerHTML = data.name;
	document.title = data.name + ' - EVEconomy';
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
function assembleColumns(id, orders, order_type) {
	let header = createElement('div', ORDERSHEAD, {classes: 'ordersheader'});

	let oc = createElement('div', undefined, {classes: 'orderscontainer', of: order_type});
	let mdiv = createElement('div', undefined, {classes: 'orders', of: order_type});

	oc.appendChild(header);
	oc.appendChild(mdiv);

	for (let order of orders) {		
		mdiv.append(createOrder(order));
	}

	let div = document.getElementById(id);
	div.innerHTML = '';
	div.appendChild(oc);	
}

function createOrder(order) {
	let pdiv = createElement('div', undefined, {classes: 'order', oid: order.order_id, price: Math.floor(order.price * 100)});
	for (let column of Object.keys(columns)) {
		let val = order[column];
		if (columns[column]['format']) val = getValueFormatted(val, columns[column]['format']);		
		
		let span = createElement('span', val, columns[column]);
		if (column == 'location_name') span.setAttribute('region_id', order.region_id);
		pdiv.appendChild(span);
	}
	//pdiv.style = 'order: ' + Math.floor(order.price * 100) + ';'
	return pdiv;
}

function createElement(element, content = '', attributes = {}) {
	let e = document.createElement(element);
	if (content) e.innerHTML = content;
	for (let attr of Object.keys(attributes)) e.setAttribute((attr == 'classes' ? 'class' : attr), attributes[attr]);
	return e;
}

function doGetJSON(path, f) {
	const xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {if (xhr.readyState === 4) f(JSON.parse(xhr.responseText));};
	xhr.open('GET', path);
	xhr.send();
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
    return parseInt(a.getAttribute('id')) - parseInt(b.getAttribute('id'));
  });
  children.forEach((child, index) => child.style.order = index);
}