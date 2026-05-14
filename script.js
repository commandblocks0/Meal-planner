const plannedWrapper = document.querySelector(".planned-wrapper")
const foodlistWrapper = document.querySelector(".foodlist-wrapper")
const plannedContainer = plannedWrapper.querySelector(".item-container")
const foodlistContainer = foodlistWrapper.querySelector(".item-container")
const contextmenu = document.querySelector(".contextmenu")

const data = JSON.parse(localStorage.getItem("foodData")) || {}
let selected = null
let dragState = null

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
        clone.querySelector(".date").textContent = i.date ? `${new Date(i.date).getDate()}.${new Date(i.date).getMonth()+1}` : ""        
        clone.addEventListener("dblclick",()=>{
            if (type==1) {
                const removed = data.planned.splice(index, 1)[0]
                if (index==0) removed.date = Date.now()
                data.foodlist.push(removed)
            } else {
                const removed = data.foodlist.splice(index, 1)[0]
                data.planned.push(removed)
            }
            display()
        })
        
        clone.addEventListener("contextmenu",(e)=>{
            contextmenu.classList.add("open")
            selected = {index, type}
            if (i.date) document.getElementById("dateInput").value = new Date(i.date).toISOString().split("T")[0]
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
    
    if (!data.planned) data.planned = []
    if (!data.foodlist) data.foodlist = []
    
    data.foodlist.sort((a, b) => {
        if (!a.date && b.date) return -1
        if (a.date && !b.date) return 1

        const dateA = new Date(a.date).setHours(0,0,0,0)
        const dateB = new Date(b.date).setHours(0,0,0,0)
    
        const diff = dateA - dateB
        if (diff !== 0) return diff
    
        return (a.name||"").localeCompare(b.name||"")
    })
    save()
    
    plannedContainer.innerHTML = ""
    data.planned.forEach((i,index)=>{
        addItem(i,index,1)
    })
    
    foodlistContainer.innerHTML = ""
    data.foodlist.forEach((i,index)=>{
       addItem(i,index,2) 
    })
}

const save = () => localStorage.setItem("foodData", JSON.stringify(data))

document.querySelector(".add-btn").addEventListener("click",()=>{
    if (!data.foodlist) data.foodlist = []
    name = prompt("Food: ")
    if (!name) return
    data.foodlist.unshift({
        name,
        date: null,
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

document.addEventListener("click",e=>{
    if (!contextmenu.contains(e.target)) {
        contextmenu.classList.remove("open")
    }
    
    if (selected && e.target.matches(".contextbtn")) {
        const list = selected.type === 1 ? data.planned : data.foodlist
        switch (e.target.dataset.action) {
            case "today":
                list[selected.index].date = Date.now()
                if (selected.type === 1) {
                    const item = list.splice(selected.index, 1)[0]
                    data.foodlist.push(item)
                }
                break
            case "switch":
                const fromList = selected.type === 1 ? data.planned : data.foodlist
                const toList = selected.type === 1 ? data.foodlist : data.planned
                const item = fromList.splice(selected.index, 1)[0]
                toList.push(item)
                break
            case "delete":
                if (!confirm("delete?")) break
                list.splice(selected.index, 1)
                break
        }
        selected = null
        contextmenu.classList.remove("open")
        display()
    }
})

document.getElementById("dateInput").addEventListener("change",(e)=>{
    if (!selected) return
    const list = selected.type === 1 ? data.planned : data.foodlist
    list[selected.index].date = new Date(e.target.value).getTime()
    display()
})

document.getElementById("nameInput").addEventListener("change",(e)=>{
    if (!selected) return
    const list = selected.type === 1 ? data.planned : data.foodlist
    list[selected.index].name = e.target.value
    display()
})

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(() => console.log('Service Worker registered'))
    .catch(err => console.log('SW error:', err));
}

display()