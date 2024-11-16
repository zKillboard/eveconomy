document.addEventListener('DOMContentLoaded', exec);

function exec() {
	const path = window.location.pathname;
	const split = path.split('/');
	
	switch(split[1]) {
	case 'item':
		return loadItem(split[2]);
	default:
		console.log('unknown path execution');
	}
}

function loadItem(item_id) {
	doGetJSON(`/api/orders/${item_id}`, showItem);
}

function showItem(data) {
	document.getElementById('itemname').innerHTML = data.name;
	assembleColumns('buyorders', data.buy);
	assembleColumns('sellorders', data.sell);
	doFormats();

	let now = Date.now();
	let then = now - (now % 900) + 900;
	console.log(then - now);
	setTimeout(exec, (then - now) * 1000);
}

const THEAD = `
<thead>
	<tr>
		<th>Location</th>
		<th class='text-end'>Price</th>
		<th class='text-end'>Remaining</th>
		<th class='text-end'>Range</th>
	</tr>
</thead>`;
const columns = {
	'location_name': {location: true},
	'price': {classes: 'format_dec text-end'},
	'volume_remain': {classes: 'format_int text-end'},
	'range': {classes: 'text-end capitalize'},
};
function assembleColumns(id, orders) {
	let table = createElement('table', undefined, {classes: 'table table-sm table-striped'});
	table.appendChild(createElement('thead', THEAD, undefined, undefined));
	let tablebody = createElement('tbody');
	table.appendChild(tablebody);

	for (let order of orders) {
		let tr = createElement('tr');
		for (let column of Object.keys(columns)) tr.appendChild(createElement('td', order[column], columns[column]));
		tablebody.append(tr);
	}

	let div = document.getElementById(id);
	div.innerHTML = '';
	div.appendChild(table);
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
	'format_int': {dec: 0}, 
	'format_dec': {dec: 2}
}
function doFormats() {
	let completed = true;
	for (let format of Object.keys(formats)) {
		let elements = document.getElementsByClassName(format);
		for (let element of elements) {
			let t = element.innerHTML;
			let n = t.length > 10 ? BigInt(t) : Number(t);			
			element.innerHTML = n.toLocaleString(undefined, {minimumFractionDigits: formats[format].dec, maximumFractionDigits: formats[format].dec});
			element.classList.remove(format);
			completed = false;
		}
	}
	if (!completed) setTimeout(doFormats, 1);
}
