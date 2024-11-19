document.addEventListener('DOMContentLoaded', exec);
document.getElementById('searchbox').addEventListener('input', doSearch);
document.getElementById('itemparent').addEventListener('click', stopCollapseToggleWhenSearching);

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
	if (localStorage) {
		localStorage.setItem("groups", itemdiv.innerHTML);
	}
}

function addGroups(parent, data, depth) {
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
	let shown = document.querySelectorAll('.groupname[aria-expanded="true"]');
	let matches = Object.values(document.getElementsByClassName('match'));
	let noncollapsing = document.querySelectorAll('.groupname[data-bs-toggle="non-collapsing"]');
	let itemparent = document.getElementById('itemparent');

	[...matches].map((li) => li.classList.remove('match'));
	[...noncollapsing].map((nc) => nc.setAttribute('data-bs-toggle', 'collapse'));
	displayElements('#searchMin', false)
	displayElements('#search0Reults', false)

	if (text.length == 0) {
		itemparent.classList.remove('searching');
	} else {
		itemparent.classList.add('searching');

		if (text.length < searchCharsMinimum) {
			displayElements('#searchMin', true);
		} else {
			let exact = searchArray.filter(element => element == text);
			if (exact.length == 1) pushLiItem(searchArrayMap[text]);

			let matches = searchArray.filter(element => element.includes(text));
			if (matches.length == 0) return displayElements('#search0Reults', true);
			console.log('matches', exact.length, matches.length);

			[...matches].map((t) => itemMatch(searchArrayMap[t]));

			noncollapsing = document.querySelectorAll('.searching .match > .groupname');
			[...noncollapsing].map((nc) => nc.setAttribute('data-bs-toggle', 'non-collapsing'));

			if (exact.length == 1) {
				console.log('scrolling');
				setTimeout(() => {itemparent.scrollTo(0, searchArrayMap[text].offsetTop - 100);}, 50);
			}
		}
	}
}

function displayElements(selector, display) {
	let f = display ? 'remove' : 'add';
	let elements = document.querySelectorAll(selector);
	[...elements].map((elem) => elem.classList[f]('d-none'));
}

function doSearchT(t, text) {
	if (t.indexOf(text) > -1) console.log(t);
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

function exec() {
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

function loadItem(item_id) {
	let epoch = Math.floor(Date.now() / 1000);
	epoch = epoch - (epoch % 900);
	doGetJSON(`/api/orders/${item_id}?epoch=${epoch}`, showItem);
}

function showItem(data) {
	document.getElementById('itemname').innerHTML = data.name;
	document.title = data.name + ' - EVEconomy';
	assembleColumns('buyorders', data.buy);
	assembleColumns('sellorders', data.sell);

	let now = Date.now();
	let then = now - (now % 900) + 900;
	setTimeout(exec, (then - now) * 1000);
}

const THEAD = `
<thead>
	<tr>
		<th class='text-end'>Remaining</th>
		<th class='text-end'>Price</th>
		<th>Location</th>
		<th class='text-end'>Range</th>
	</tr>
</thead>`;
const columns = {
	'volume_remain': {field: 'volume_remain', format: 'int', classes: 'text-end'},
	'price': {field: 'price', format: 'dec', classes: 'text-end'},
	'location_name': {field: 'location_name', location: true},
	'range': {field: 'range', classes: 'text-end capitalize'},
};
function assembleColumns(id, orders) {
	let table = createElement('table', undefined, {classes: 'table table-sm table-striped'});
	table.appendChild(createElement('thead', THEAD, undefined, undefined));
	let tablebody = createElement('tbody');
	table.appendChild(tablebody);

	for (let order of orders) {
		let tr = createElement('tr');
		for (let column of Object.keys(columns)) {
			let val = order[column];
			if (columns[column]['format']) val = getValueFormatted(val, columns[column]['format']);
			tr.appendChild(createElement('td', val, columns[column]));
		}
		tablebody.append(tr);
	}

	let div = document.getElementById(id);
	div.innerHTML = '';
	div.appendChild(table);
	setTimeout(loadGroups, 1);
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
	let n = value.length > 10 ? BigInt(value) : Number(value);
	let dec = formats[format];
	return n.toLocaleString(undefined, {minimumFractionDigits: dec, maximumFractionDigits: dec});
}