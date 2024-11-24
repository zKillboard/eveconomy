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
function loadGroups() {
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

let ws;
function exec() {
	ws = new ReconnectingWebSocket(websocket_url);
	ws.onopen = wsOpen;

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

function wsOpen() {
	console.log('websocket connected');
	ws.onmessage = wsMessage;
}

function wsMessage(event) {
	try {
		let data = JSON.parse(event.data);

		if (data.action == 'insert') {
			let order_parent;
			if (data.order.is_buy_order) {
				order_parent = document.querySelector('.orders[of="buy"]');
			} else {
				order_parent = document.querySelector('.orders[of="sell"]');
			}

			let odiv = createOrder(data.order);
			odiv.classList.add('insert')
			order_parent.appendChild(odiv);
			scheduleClass(odiv, 'insert');
			console.log('inserted', data.order.order_id);
		} else if (data.action == 'modify') {
			let order_id = data.order.order_id;
			let order = document.querySelector(`.order[id="${order_id}"]`);
			if (order) {
				let volume_remain = getValueFormatted(data.order.volume_remain, 'int');
				let span_vr = document.querySelector(`.order[id="${order_id}"] span[field="volume_remain"]`);
				if (volume_remain != span_vr.innerHTML) {
					scheduleClass(span_vr, 200);
					span_vr.innerHTML = volume_remain;
				}
				let span_price = document.querySelector(`.order[id="${order_id}"] span[field="price"]`);
				let price = getValueFormatted(data.order.price, 'dec');
				if (price != span_price.innerHTML) {
					scheduleClass(span_price, 200);
					span_price.innerHTML = price;
					order.setAttribute('style', "order: " + Math.floor(data.order.price * 100));
				}
				
				console.log('modified', data.order.order_id);
				scheduleClass(order, 'modify');
			}
		} else if (data.action == 'remove') {
			let order_id = data.order.order_id;
			let order = document.querySelector(`.order[id="${order_id}"]`);
			if (order) {
				scheduleClass(order, 'remove', 2000);
				scheduleRemoval(order);
				console.log('removed', order_id);
			}
		} else if (data.action == 'refresh') window.location = window.location;
		else {console.error('unknown action', data)};
	} catch (e) {
		console.log(e);
	}
}

function scheduleClass(element, className, timeout = 4000) {
	element.classList.add(className);
	setTimeout(() => { element.classList.remove(className); }, timeout + 1);
	return element;
}

function scheduleRemoval(element, timeout = 1000) {
	setTimeout(() => { element.remove(); }, timeout);
}

function wsSub(channel) {
    try {
        ws.send(JSON.stringify({'action':'sub', 'channel': channel}));
        console.log("subscribing to " + channel);
    } catch (e) {
        setTimeout("wsSub('" + channel + "');", 10);
    }
}

function wsUnsub(channel) {
    try {
        ws.send(JSON.stringify({'action':'unsub', 'channel': channel}));
        console.log("unsubscribing from " + channel);
    } catch (e) {
        setTimeout("wsUnsub('" + channel + "');", 10);
    }
}

let current_item_id = null;
function loadItem(item_id) {
	let epoch = Math.floor(Date.now() / 1000);
	epoch = epoch - (epoch % 900);
	doGetJSON(`/api/orders?epoch=${epoch}&item=${item_id}`, populateOrders);
	if (current_item_id != item_id) {
		doGetJSON(`/api/info?id=${item_id}&type=item_id`, populateInfo);
		if (current_item_id != null) wsUnsub(`item:${current_item_id}`);
		current_item_id = item_id;	
	}
}

function populateOrders(data) {
	setTimeout(loadGroups, 1);
	
	document.getElementById('itemimg').setAttribute('src', `https://images.evetech.net/types/${data.id}/icon?size=128`);
	assembleColumns('buyorders', data.buy, "buy");
	assembleColumns('sellorders', data.sell, "sell");

	wsSub(`item:${current_item_id}`)
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
	let pdiv = createElement('div', undefined, {classes: 'order', id: order.order_id, style: 'order: ' +  Math.floor(order.price * 100)});
	for (let column of Object.keys(columns)) {
		let val = order[column];
		if (columns[column]['format']) val = getValueFormatted(val, columns[column]['format']);		
		
		let span = createElement('span', val, columns[column]);
		if (column == 'location_name') span.setAttribute('region_id', order.region_id);
		pdiv.appendChild(span);
	}
	return pdiv;
}

function createElement(element, content = '', attributes = {}) {
	let e = document.createElement(element);
	for (let attr of Object.keys(attributes)) e.setAttribute((attr == 'classes' ? 'class' : attr), attributes[attr]);
	if (content) e.innerHTML = content;
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