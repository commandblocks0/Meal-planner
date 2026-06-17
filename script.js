const plannedWrapper = document.querySelector(".planned-wrapper")
const foodlistWrapper = document.querySelector(".foodlist-wrapper")
const plannedContainer = plannedWrapper.querySelector(".item-container")
const foodlistContainer = foodlistWrapper.querySelector(".item-container")
const contextmenu = document.querySelector(".contextmenu")
const historyScreen = document.querySelector(".history-screen")

const data = JSON.parse(localStorage.getItem("foodData")) || {}
let selected = null
let dragState = null
let filter = ""

if (!data.planned) data.planned = []
if (!data.foodlist) data.foodlist = []
data.planned.forEach(i=>{
    if (!i.dates) {
        i.dates = []
        if (i.date) {
            i.dates.push(i.date)
            delete i.date
        }
    }
})
data.foodlist.forEach(i=>{
    if (!i.dates) {
        i.dates = []
        if (i.date) {
            i.dates.push(i.date)
            delete i.date
        }
    }
})

function getSelectedItem() {
    if (!selected) return null

    const list = selected.type === 1 ? data.planned : data.foodlist
    return {
        item: list.find(i => i.id === selected.id),
        index: list.findIndex(i => i.id === selected.id)
    }
}

function movePlaceholder(container, y) {
    const items = [...container.querySelectorAll(".item")]
    const before = items.find(item => y < item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2)
    if (before) {
        container.insertBefore(dragState.placeholder, before)
    } else {
        container.appendChild(dragState.placeholder)
    }
}

function onDragMove(e) {
    if (!dragState) return
    if (e.pointerId !== dragState.pointerId) return
    const x = dragState.lockedLeft
    const y = e.clientY - dragState.offsetY
    dragState.item.style.left = `${x}px`
    dragState.item.style.top = `${y}px`

    movePlaceholder(plannedContainer, e.clientY)
}

function onDragEnd(e) {
    if (!dragState) return
    if (e && e.pointerId !== undefined && e.pointerId !== dragState.pointerId) return

    document.removeEventListener("pointermove", onDragMove)
    document.removeEventListener("pointerup", onDragEnd)
    document.removeEventListener("pointercancel", onDragEnd)
    document.body.style.overflow = ""

    const targetContainer = dragState.placeholder.parentElement
    if (!targetContainer) {
        dragState.item.remove()
        dragState.placeholder.remove()
        dragState = null
        display()
        return
    }

    const fromList = data.planned
    const fromIndex = fromList.findIndex(i => i.id === dragState.id)
    if (fromIndex === -1) {
        dragState.item.remove()
        dragState.placeholder.remove()
        dragState = null
        display()
        return
    }
    const movedItem = fromList.splice(fromIndex, 1)[0]

    const insertIndex = [...targetContainer.children].indexOf(dragState.placeholder)
    data.planned.splice(insertIndex, 0, movedItem)

    dragState.item.remove()
    dragState.placeholder.remove()
    dragState = null
    display()
}

function setupDragging(clone, type) {
    const handle = clone.querySelector(".drag-handle")

    if (type !== 1) {
        handle.classList.add("hidden")
        return
    }

    handle.addEventListener("pointerdown", e => {
        if (e.pointerType === "mouse" && e.button !== 0) return
        e.preventDefault()
        handle.setPointerCapture(e.pointerId)

        const rect = clone.getBoundingClientRect()
        const placeholder = document.createElement("div")
        placeholder.classList.add("drop-placeholder")
        placeholder.style.height = `${rect.height}px`

        clone.parentElement.insertBefore(placeholder, clone)
        clone.classList.add("dragging")
        clone.style.width = `${rect.width}px`
        clone.style.height = `${rect.height}px`
        clone.style.left = `${rect.left}px`
        clone.style.top = `${rect.top}px`
        document.body.appendChild(clone)

        dragState = {
            id: clone.dataset.id,
            item: clone,
            placeholder,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top,
            lockedLeft: rect.left,
            pointerId: e.pointerId
        }

        document.body.style.overflow = "hidden"
        document.addEventListener("pointermove", onDragMove)
        document.addEventListener("pointerup", onDragEnd)
        document.addEventListener("pointercancel", onDragEnd)
    })
}

function display() {
    function addItem(i,index,type) {
        const clone = document.querySelector(".item-template").content.cloneNode(true).firstElementChild
        clone.dataset.id = i.id
        clone.querySelector(".name").textContent = i.name
        clone.querySelector(".date").textContent = i.dates.length ? `${new Date(i.dates.at(-1)).getDate()}.${new Date(i.dates.at(-1)).getMonth()+1}` : ""        
        clone.querySelector(".count").textContent = i.dates.length ? i.dates.length : ""
        clone.addEventListener("dblclick",()=>{
            if (type==1) {
                const removed = data.planned.splice(index, 1)[0]
                if (index==0) removed.dates.push(Date.now())
                data.foodlist.push(removed)
            } else {
                const removed = data.foodlist.splice(index, 1)[0]
                data.planned.push(removed)
            }
            display()
        })
        
        clone.addEventListener("contextmenu",(e)=>{
            contextmenu.classList.add("open")
            selected = {id: i.id, type}
            if (i.dates.length) document.getElementById("dateInput").value = new Date(i.dates.at(-1)).toISOString().split("T")[0]
            else document.getElementById("dateInput").value = ""
            document.getElementById("nameInput").value = i.name
        })

        setupDragging(clone, type)
        
        if (type==1) {
            plannedContainer.appendChild(clone)
        } else {
            foodlistContainer.appendChild(clone)
        }
    }
    
    data.foodlist.sort((a, b) => {
        if (!a.dates.length && b.dates.length) return -1
        if (a.dates.length && !b.dates.length) return 1
    
        if (!a.dates.length && !b.dates.length)
            return (a.name || "").localeCompare(b.name || "")
    
        const dateA = new Date(a.dates.at(-1)).setHours(0,0,0,0)
        const dateB = new Date(b.dates.at(-1)).setHours(0,0,0,0)
    
        const diff = dateA - dateB
        if (diff !== 0) return diff
    
        const countDiff = a.dates.length - b.dates.length
        if (countDiff !== 0) return countDiff
    
        return (a.name || "").localeCompare(b.name || "")
    })
    save()
    
    plannedContainer.innerHTML = ""
    data.planned.forEach((i,index)=>{
        if (i.name.toLowerCase().includes(filter))
            addItem(i,index,1)
    })
    
    foodlistContainer.innerHTML = ""
    data.foodlist.forEach((i,index)=>{
        if (i.name.toLowerCase().includes(filter))
            addItem(i,index,2) 
    })
}

const save = () => localStorage.setItem("foodData", JSON.stringify(data))

document.querySelector(".add-btn").addEventListener("click",()=>{
    if (!data.foodlist) data.foodlist = []
    name = prompt("Food: ")
    if (!name) return
    data.foodlist.push({
        name,
        dates: [],
        id: crypto.randomUUID()
    })
    display()
})

document.querySelector(".backup-btn").addEventListener("click", () => {
    const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: "application/json" }
    )

    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = "meal-planner-backup.json"

    a.click()

    URL.revokeObjectURL(url)
})

document.querySelector(".upload-btn").addEventListener("click",e=>{
    document.getElementById("uploadInput").click()
})
document.getElementById("uploadInput").addEventListener("change",async e=>{
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    localStorage.setItem("foodData", text)
    location.reload()
})

document.addEventListener("click",e=>{
    if (!contextmenu.contains(e.target) && !historyScreen.contains(e.target)) {
        contextmenu.classList.remove("open")
    }
    
    if (selected && e.target.matches(".contextbtn")) {
        const list = selected.type === 1 ? data.planned : data.foodlist
        switch (e.target.dataset.action) {
            case "today": {
                const item = getSelectedItem().item
                const index = getSelectedItem().index
                item.dates.push(Date.now())
            
                if (selected.type === 1) {
                    list.splice(index, 1)
                    data.foodlist.push(item)
                }
            
                document.getElementById("dateInput").value =
                    item.dates.length
                        ? new Date(item.dates.at(-1)).toISOString().split("T")[0]
                        : ""
                display()
                return
            }
            case "switch": {
                const index = getSelectedItem().index
                const fromList = selected.type === 1 ? data.planned : data.foodlist
                const toList = selected.type === 1 ? data.foodlist : data.planned
                const item = fromList.splice(index, 1)[0]
                toList.push(item)
                break
            }
            case "history": {
                const index = getSelectedItem().index
                historyScreen.classList.add("open")
                historyScreen.querySelector(".title").textContent = list[index].name
                
                const dateContainer = historyScreen.querySelector(".date-container")
                dateContainer.innerHTML = ""
                for (const i of [...list[index].dates].reverse()) {
                    const item = document.createElement("div")
                    item.classList.add("item")
                    item.textContent = `${new Date(i).getDate()}.${new Date(i).getMonth()+1}`
                    dateContainer.appendChild(item)
                }
                return
            }
            case "delete": {
                if (!confirm("delete?")) break
                const index = getSelectedItem().index
                list.splice(index, 1)
                break
            }
        }
        selected = null
        contextmenu.classList.remove("open")
        display()
    }
})

document.getElementById("dateInput").addEventListener("change",(e)=>{
    if (!selected) return
    const index = getSelectedItem().index
    const list = selected.type === 1 ? data.planned : data.foodlist
    const dates = list[index].dates
    if (e.target.value!="")
        if (dates.length) dates[dates.length-1] = new Date(e.target.value).getTime()
        else dates.push(new Date(e.target.value).getTime())
    else dates.pop()
    document.getElementById("dateInput").value = dates.length ? new Date(dates.at(-1)).toISOString().split("T")[0] : ""
    display()
})

document.getElementById("nameInput").addEventListener("change",(e)=>{
    if (!selected) return
    const index = getSelectedItem().index
    const list = selected.type === 1 ? data.planned : data.foodlist
    list[index].name = e.target.value
    display()
})

let historyStartY
let historyDragging = false

historyScreen.addEventListener("touchstart", e => {
    if (historyScreen.querySelector(".date-container").scrollTop === 0) {
        historyStartY = e.touches[0].clientY
        historyDragging = true
    }
})

window.addEventListener("touchmove", e => {
    if (!historyDragging) return

    const dy = Math.max(0, e.touches[0].clientY - historyStartY)
    historyScreen.style.transform = `translateY(${dy}px)`
})

window.addEventListener("touchend", e => {
    if (!historyDragging) return
    historyDragging = false

    const dy = e.changedTouches[0].clientY - historyStartY

    if (dy > 100) {
        historyScreen.animate([
            {transform: "translateY(100%)",opacity:0}
        ],{
            duration: 500
        })
        setTimeout(()=>{
            historyScreen.classList.remove("open")
            historyScreen.style.transform = "translateY(0)"
        },500)
    } else {
        historyScreen.animate([
            {transform: "translateY(0)"}
        ],{
            duration: 100
        })
        setTimeout(()=>
            historyScreen.style.transform = "translateY(0)"
        ,100)
    }
})

document.querySelector(".search-input").addEventListener("input",e=>{
    filter = e.target.value.toLowerCase()
    display()
})

document.querySelector(".search-clear").addEventListener("click",e=>{
    document.querySelector(".search-input").value = ""
    filter = ""
    display()
})

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(() => console.log('Service Worker registered'))
    .catch(err => console.log('SW error:', err));
}

display()