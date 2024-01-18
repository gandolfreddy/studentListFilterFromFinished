// ==UserScript==
// @name         完課學生資料過濾器
// @namespace    http://tampermonkey.net/
// @version      1.0
// @source       https://raw.githubusercontent.com/gandolfreddy/studentListFilterFromFinished/main/src/studentListFilterFromFinished.js
// @namespace    https://raw.githubusercontent.com/gandolfreddy/studentListFilterFromFinished/main/src/studentListFilterFromFinished.js
// @description  從完課學生名單中，過濾出需要的學生名單
// @author       Gandolfreddy
// @match        https://corp.orangeapple.co/calendar
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    // 加入 CSS
    GM_addStyle(`
        .floating-message-window-shrinked {
            position: fixed;
            top: 50px;
            right: 20px;
            z-index: 1000;
            background-color: rgb(52,196,168, 0.8);
            color: #fff;
            font-weight: bold;
            font-size: 14px;
            font-family: "consolas";
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: 2px solid #fff;
            cursor: pointer;

            display: flex;
            justify-content: center;
            align-items: center;
        }
        .floating-message-window-shrinked:hover {
            background-color: rgb(52,196,168, 0.6);
        }
        .floating-message-window-extended {
            font-family: "consolas";
            position: fixed;
            top: 50px;
            right: 20px;
            z-index: 1000;
            background-color: #fff;
            color: #000;
            width: 650px;
            height: 600px;
            padding: 10px 20px 30px 20px;
            border-radius: 8px;
            border: 2px solid rgb(0, 0, 0, 0.5);
            cursor: default;

            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: center;
        }
        #floating-message-window-title {
            font-size: 25px;
            font-weight: bold;
            color: rgb(0, 0, 0, 0.7);
        }
        #studentList {
            width: 100%;
            height: 100%;
            overflow: auto;
            padding: 10px;
            box-sizing: border-box;
            font-family: "consolas";
        }
        #studentList > .card {
            box-shadow: 0 0 6px rgb(0, 0, 0, 0.5);
            width: 90%;
            margin: 10px;
        }
        /* width */
        #studentList::-webkit-scrollbar {
            width: 8px;
        }
        /* Track */
        #studentList::-webkit-scrollbar-track {
            background: #f1f1f1; 
        }
        /* Handle */
        #studentList::-webkit-scrollbar-thumb {
            background: rgb(52,196,168, 0.7);
        }
        /* Handle on hover */
        #studentList::-webkit-scrollbar-thumb:hover {
            background: rgb(52,196,168, 0.4);
        }
        .dragging {
            cursor: grabbing;
        }
        #inputURL {
            height: 250px;
        }
    `);

    // SPINNER 用來顯示更新時圖示
    const SPINNER = `
    <div class="spinner-border text-success my-2" role="status">
        <span class="visually-hidden">Loading...</span>
    </div>
    `;

    // TITLEHINT 用來顯示功能提示
    const TITLEHINT = {
        updateRawData: "更新學生內部訊息資料（內部訊息有更動再執行即可）",
        currentData: "顯示目前抓取的內部訊息",
    }

    // studentListLogging 用來記錄更新時的狀態
    let studentListLogging = '';

    // 從瀏覽器的 localStorage 取得資料
    let allMsgsInfo = JSON.parse(localStorage.getItem("allMsgsInfo")) || {
        classroomLinks: [],
        rawData: []
    };

    // 加入懸浮訊息小視窗，並加入點擊事件，點選後會展開小視窗，並顯示學生名單
    let isExtended = false,
        isUpdating = false;
    let circle = addFloatingMessageWindow();
    let preCircleLeft = circle.getBoundingClientRect().left,
        preCircleTop = circle.getBoundingClientRect().top;
    circle.addEventListener("click", showExtendedFloatingMessageWindow, true);

    // rawData 處理函式
    async function processRawData(links) {
        // 處理不允許的操作
        isUpdating = true;
        let studentList = document.querySelector("#studentList");
        studentList.innerHTML = studentListLogging;
        document.querySelector("#updateRawData").disabled = true;
        document.querySelector("#currentData").disabled = true;
        document.querySelector("#downloadData").disabled = true;

        // 顯示抓取進度
        studentListLogging += `
        <div class="alert alert-warning" role="alert">
            開始抓取學生內部訊息
        </div>
        `;
        if (isExtended) {
            document.querySelector("#studentList").innerHTML = studentListLogging + SPINNER;
        }
        // 開始更新 rawData
        for (let link of links) {

            // 進入「總覽」頁面
            let res = await fetch(link).then(res => res.text());
            let currentPageDOM = new DOMParser().parseFromString(res, 'text/html');
            let body = currentPageDOM.querySelector('body');
            let classroomName = body.children[0].children[0].children[1].children[0].children[2].nextSibling.data.replace(' > ', '');
            let classroomURL = link;

            // 顯示抓取進度
            studentListLogging += `
            <div class="alert alert-warning" role="alert">
                正在抓取<a href='${classroomURL}' target="_blank">${classroomName}</a>學生內部訊息
            </div>
            `;
            if (isExtended) {
                document.querySelector("#studentList").innerHTML = studentListLogging + SPINNER;
            }

            // 進入「課堂紀錄」頁面
            if (classroomURL.includes('dt')) {
                res = await fetch(`${link}/lesson_reports`).then(res => res.text());
                currentPageDOM = new DOMParser().parseFromString(res, 'text/html');
            }
            let table = null;
            table = currentPageDOM.querySelector("table.table-text-center.table.table-bordered");
            if (classroomURL.includes('stages')) {
                table = currentPageDOM.querySelector("table.table.table-bordered.js-freeze");
            }
            let students = [];
            for (let tr of table.children[1].children) {
                let studentName = tr.children[0].children[0].innerText;
                let forInternalMsg = tr.children[0].querySelector("a.edit-admission-comment.admission-comment.me-1").children[1].innerText.trim();
                let forTeacherMsg = tr.children[0].querySelector("a.edit-admission-teacher-comment.admission-comment.me-1").children[1].innerText.trim();
                students.push({
                    studentName: studentName,
                    forInternalMsg: forInternalMsg,
                    forTeacherMsg: forTeacherMsg,
                });
            }

            // 如果 rawData 中已有此班級的資料，則更新資料，否則新增資料
            let isClassroomExist = false;
            for (let classroom of allMsgsInfo.rawData) {
                if (classroom.classroomURL === classroomURL) {
                    classroom.classroomName = classroomName;
                    classroom.students = students;
                    isClassroomExist = true;
                    break;
                }
            }
            if (!isClassroomExist) {
                allMsgsInfo.rawData.push({
                    classroomName: classroomName,
                    classroomURL: classroomURL,
                    students: students,
                });
            }
        }
        // 儲存至瀏覽器的 localStorage
        localStorage.setItem("allMsgsInfo", JSON.stringify(allMsgsInfo));

        // 將不允許的操作還原
        isUpdating = false;
        if (!isExtended) showExtendedFloatingMessageWindow();
        studentList = document.querySelector("#studentList");
        studentListLogging = `
        <div class="alert alert-success" role="alert">
            資料更新完成！
        </div>`;
        studentList.innerHTML = studentListLogging;
        document.querySelector("#updateRawData").disabled = false;
        document.querySelector("#currentData").disabled = false;
        document.querySelector("#downloadData").disabled = false;

        // 顯示目前抓取的內部訊息
        showStudentList(allMsgsInfo.rawData);
    }

    // 學生內部訊息顯示函式
    function showStudentList(chosenStudentList) {
        /* 
        學生內部訊息顯示
        功能：顯示對應的學生內部訊息。
        */
        // 將 #studentList 的畫面捲動至最上方
        document.querySelector("#studentList").scrollTop = 0;
        // 顯示結果
        document.querySelector("#studentList").innerHTML = "";
        if (chosenStudentList.length === 0) {
            document.querySelector("#studentList").innerHTML = `
            <div class="alert alert-danger" role="alert">
                目前無學生資料，請更新。
            </div>`;
            return;
        }
        for (let classroom of chosenStudentList) {
            for (let student of classroom.students) {
                if (student.forInternalMsg === '' && student.forTeacherMsg === '') continue;
                document.querySelector("#studentList").innerHTML += `
                <div class="card">
                    <div class="card-header text-bg-primary">
                        <h4 class="card-title"><a href='${classroom.classroomURL}' target="_blank">${classroom.classroomName}</a></h4>
                    </div>
                    <div class="card-body" style="width: 100%">
                        <h4 class="card-title"><span class="badge bg-warning">${student.studentName}</span></h4>
                        ${(student.forInternalMsg !== '') ? `
                        <p class="card-text">
                            <h5 class="card-title"><span class="badge bg-danger">給內部訊息</span></h5>
                            ${student.forInternalMsg}
                        </p>
                        ` : ''}
                        ${(student.forTeacherMsg !== '') ? `
                        <p class="card-text">
                            <h5 class="card-title"><span class="badge bg-success">給老師訊息</span></h5>
                            ${student.forTeacherMsg}
                        </p>
                        ` : ''}
                    </div>
                </div>
                `;
            }

        }
    }

    // 加入懸浮訊息小視窗 
    function addFloatingMessageWindow() {
        /* 
        加入懸浮訊息小視窗 
        功能： 
        1. 縮圖為圓圈，內帶有 KH 字樣。
        2. 點擊後，會顯示展開一個小視窗，內容為取得的學生名單內容。
        3. 縮小後可任意拖動至畫面任何位置，重新整理畫面後，預設位置於畫面內右上角。
        */
        let floatingMessageWindow = document.createElement("div");
        floatingMessageWindow.classList.add("floating-message-window-shrinked");
        floatingMessageWindow.innerHTML = "MSG";
        floatingMessageWindow.title = "點擊展開小視窗\n按住 CTRL + 滑鼠左鍵，便可以將懸浮訊息小視窗任意移動到目前視窗的各位置";
        document.body.appendChild(floatingMessageWindow);
        return floatingMessageWindow;
    }

    // 懸浮訊息小視窗點擊後會展開小視窗的函式
    function showExtendedFloatingMessageWindow() {
        /* 
        懸浮訊息小視窗 
        功能： 
        1. 點選小視窗右上角的「最小化」按鈕，可以縮小小視窗。
        */
        let floatingMessageWindow = document.querySelector(".floating-message-window-shrinked");
        if (!floatingMessageWindow && isExtended) return;
        isExtended = true;
        if (preCircleLeft !== floatingMessageWindow.getBoundingClientRect().left) {
            preCircleLeft = floatingMessageWindow.getBoundingClientRect().left;
            preCircleTop = floatingMessageWindow.getBoundingClientRect().top;
            return;
        }
        floatingMessageWindow.style.left = preCircleLeft - 600 + 'px';
        floatingMessageWindow.classList.remove("floating-message-window-shrinked");
        floatingMessageWindow.classList.add("floating-message-window-extended");
        floatingMessageWindow.title = "";
        floatingMessageWindow.innerHTML = `
        <div class="d-flex justify-content-between align-items-center my-2" style="width: 100%;">
            <div id="floating-message-window-title">各班級學生內部訊息</div>
            <button id="minimize-btn" type="button" class="btn-close" aria-label="Close"></button>
        </div>
        <div class="d-flex justify-content-between align-items-center pt-2 pb-3" style="width: 100%;">
            <div>
                <button id="updateRawData" class='btn btn-outline-dark mr-1' title="${TITLEHINT.updateRawData}">更新原始資料</button>
                <button id="currentData" class='btn btn-success' title="${TITLEHINT.currentData}">顯示目前抓取的內部訊息</button>
            </div>
            <button id="downloadData" class='btn btn-outline-dark' title="下載目前選擇的學生資料"><i class="fa-solid fa-download"></i></button>
        </div>
        <div id="studentList" class="border-bottom border-top"></div>
            `;

        // 懸浮訊息小視窗縮小按鈕點擊事件
        document.querySelector("#minimize-btn")
            .addEventListener("click", closeFloatingMessageWindow, false);

        // 更新 rawData 按鈕點擊事件
        document.querySelector("#updateRawData")
            .addEventListener("click", addURLPage, false);

        // 顯示目前抓取的內部訊息按鈕點擊事件
        document.querySelector("#currentData")
            .addEventListener("click", showStudentList.bind(null, allMsgsInfo.rawData), false);

        // 下載資料按鈕點擊事件
        document.querySelector("#downloadData")
            .addEventListener("click", () => {
                let chosenStudentList = allMsgsInfo.rawData, fileName = 'studentInternalMsg';
                let code = '';
                for (let classroom of chosenStudentList) {
                    code += `${classroom.classroomName} - ${classroom.classroomURL} \n`;
                    for (let student of classroom.students) {
                        if (student.forInternalMsg === '' && student.forTeacherMsg === '') continue;
                        code += `\t${student.studentName} `;
                        if (student.forInternalMsg !== '') {
                            code += ` - 內部訊息：「${student.forInternalMsg}」`;
                        }
                        if (student.forTeacherMsg !== '') {
                            code += ` - 給老師訊息：「${student.forTeacherMsg}」`;
                        }
                        code += '\n';
                    }
                    code += '\n';
                }
                downloadSourceCode(code, `${fileName}_內部訊息_${new Date().toLocaleDateString()}.txt`);
            });

        // 若正在更新資料，則顯示目前更新進度與 SPINNER
        if (isUpdating) {
            let studentList = document.querySelector("#studentList");
            studentList.innerHTML = studentListLogging + SPINNER;
            document.querySelector("#updateRawData").disabled = true;
            document.querySelector("#currentData").disabled = true;
            document.querySelector("#downloadData").disabled = true;
            return;
        }

        // 顯示目前抓取的內部訊息
        showStudentList(allMsgsInfo.rawData);
    }

    // 關閉懸浮訊息小視窗的函式
    function closeFloatingMessageWindow() {
        /* 
        關閉懸浮訊息小視窗 
        功能： 
        1. 點選小視窗右上角的「最小化」按鈕，可以縮小小視窗。
        */
        let floatingMessageWindow = document.querySelector(".floating-message-window-extended");
        let floatingMessageWindowRect = floatingMessageWindow.getBoundingClientRect();
        preCircleLeft = floatingMessageWindowRect.left;
        preCircleTop = floatingMessageWindowRect.top;
        isExtended = false;
        floatingMessageWindow.style.left = preCircleLeft + floatingMessageWindowRect.width - 50 + 'px';
        floatingMessageWindow.classList.remove("floating-message-window-extended");
        floatingMessageWindow.classList.add("floating-message-window-shrinked");
        floatingMessageWindow.innerHTML = "MSG";
        floatingMessageWindow.title = "點擊展開小視窗\n按住 CTRL + 滑鼠左鍵，便可以將懸浮訊息小視窗任意移動到目前視窗的各位置";
        floatingMessageWindowRect = floatingMessageWindow.getBoundingClientRect();
        preCircleLeft = floatingMessageWindowRect.left;
        preCircleTop = floatingMessageWindowRect.top;
    }

    // 加入網址的頁面
    function addURLPage() {
        /* 
        加入網址的頁面 
        功能： 
        1. 加入網址的頁面，讓使用者可以自行輸入網址。
        2. 點選「更新」按鈕後，會將網址加入 allMsgsInfo.classroomLinks 中，並執行 await processRawData(allMsgsInfo.classroomLinks)。
        3. 其中於文字輸入框中，若有多個網址，請以換行分隔。
        4. 其中於文字輸入框中，若有 # 開頭的文字，則會被當作註解，不會被加入 allMsgsInfo.classroomLinks 中。
        */
        let studentList = document.querySelector("#studentList");
        studentList.innerHTML = `
        <div class="alert alert-warning" role="alert">
            請輸入網址，並點選「更新」按鈕。
        </div >
        <div class="input-group mb-3">
            <span class="input-group-text">網址</span>
            <textarea id="inputURL" class="form-control" aria-label="With textarea"></textarea>
        </div>
        <div class="d-flex justify-content-between align-items-center pt-2 pb-3" style="width: 100%;">
            <button id="updateURL" class='btn btn-success'>更新</button>
        </div>
            `;
        let inputURLArea = document.querySelector("#inputURL");
        inputURLArea.value = allMsgsInfo.classroomLinks.length !== 0 ? allMsgsInfo.classroomLinks.join("\n") : '';
        document.querySelector("#updateURL")
            .addEventListener("click", async () => {
                let inputURL = document.querySelector("#inputURL").value;
                let classroomLinks = inputURL.split("\n");
                allMsgsInfo.classroomLinks = classroomLinks;
                localStorage.setItem("allMsgsInfo", JSON.stringify(allMsgsInfo));
                classroomLinks = classroomLinks.filter(link => !link.includes("#") && link !== "");
                await processRawData(classroomLinks);
            });
    }


    // 下載原始碼函式，用法：downloadSourceCode("原始碼", "檔案名稱");
    function downloadSourceCode(code, filename) {
        let element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(code));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    /* 實驗性功能：按住 Ctrl + 滑鼠，便可以將懸浮訊息小視窗任意移動到目前視窗的各位置 */
    // 初始化變數來追蹤拖動
    let isDragging = false;
    let offsetX, offsetY;

    // 取得圓圈元素
    circle = document.querySelector('.floating-message-window-shrinked');

    // 滑鼠按下事件
    circle.onmousedown = function (e) {
        if (!e.ctrlKey) return;
        isDragging = true;
        preCircleLeft = circle.getBoundingClientRect().left;
        preCircleTop = circle.getBoundingClientRect().top;
        offsetX = e.clientX - preCircleLeft;
        offsetY = e.clientY - preCircleTop;
        circle.classList.add("dragging");
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // 滑鼠移動事件
    function onMouseMove(e) {
        if (!isDragging) return;
        circle.style.left = e.clientX - offsetX + 'px';
        circle.style.top = e.clientY - offsetY + 'px';
    }

    // 滑鼠放開事件
    function onMouseUp() {
        isDragging = false;
        circle.classList.remove("dragging");
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
    /* 實驗性功能結尾 */
})();
