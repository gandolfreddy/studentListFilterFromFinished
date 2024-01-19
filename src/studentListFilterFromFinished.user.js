// ==UserScript==
// @name         完課學生資料過濾器（修改中）
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
            top: 300px;
            right: 20px;
            z-index: 1000;
            background-color: rgb(186,37,100, 0.8);
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
            background-color: rgb(186,37,100, 0.6);
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
            height: 700px;
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
        #inputURL {
            height: 350px;
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
        updateRawData: "更新學生名單（名單有更動再執行即可）",
        currentData: "顯示目前抓取的名單",
    }

    // 年級
    const GRADE = {
        "一年級": 1,
        "小一": 1,
        "二年級": 2,
        "小二": 2,
        "三年級": 3,
        "小三": 3,
        "四年級": 4,
        "小四": 4,
        "五年級": 5,
        "小五": 5,
        "六年級": 6,
        "小六": 6,
        "七年級": 7,
        "國一": 7,
        "八年級": 8,
        "國二": 8,
        "九年級": 9,
        "國三": 9,
        "十年級": 10,
        "高一": 10,
        "十一年級": 11,
        "高二": 11,
        "十二年級": 12,
        "高三": 12,
    };

    // 設定根連結
    const ROOTLINK = "https://corp.orangeapple.co";

    // studentListLogging 用來記錄更新時的狀態
    let studentListLogging = '';

    // 從瀏覽器的 localStorage 取得資料
    let allFinishedInfo = JSON.parse(localStorage.getItem("allFinishedInfo")) || {
        classroomLinks: [],
        rawData: []
    };

    // 目前畫面上選擇的資料
    let chosenStudentList = [];

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
            開始抓取完課學生名單
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

            if (!classroomURL.includes('dt')) {
                continue;
            }

            // 顯示抓取進度
            studentListLogging += `
            <div class="alert alert-warning" role="alert">
                正在抓取<a href='${classroomURL}' target="_blank">${classroomName}</a>完課學生名單
            </div>
            `;
            if (isExtended) {
                document.querySelector("#studentList").innerHTML = studentListLogging + SPINNER;
            }

            // 進入「完課學生」頁面
            let div = body.querySelector('div#finished-dt-admissions.tab-pane.fade');
            let currentLink = ROOTLINK + div.firstChild.attributes.src.value;
            res = await fetch(currentLink).then(res => res.text());
            currentPageDOM = new DOMParser().parseFromString(res, 'text/html');

            let tbody = currentPageDOM.querySelector('tbody');
            let trs = tbody.querySelectorAll('tr');
            let studentsObj = {};
            for (let i = trs.length - 1; i > 0; i--) {
                let tds = trs[i].querySelectorAll('td');
                if (!(tds[0].innerText in studentsObj)) {
                    studentsObj[tds[0].innerText] = {
                        userPageURL: tds[0].children[0].href,
                        grade: tds[1].innerText,
                        parentName: tds[3].innerText,
                        parentPageURL: tds[3].children[0].href,
                        course: tds[5].innerText,
                    }
                }
            }

            // 如果 rawData 中已有此班級的資料，則更新資料，否則新增資料
            let isClassroomExist = false;
            for (let classroom of allFinishedInfo.rawData) {
                if (classroom.classroomURL === classroomURL) {
                    classroom.classroomName = classroomName;
                    classroom.students = studentsObj;
                    isClassroomExist = true;
                    break;
                }
            }
            if (!isClassroomExist) {
                allFinishedInfo.rawData.push({
                    classroomName: classroomName,
                    classroomURL: classroomURL,
                    students: studentsObj,
                });
            }
        }
        // 儲存至瀏覽器的 localStorage
        localStorage.setItem("allFinishedInfo", JSON.stringify(allFinishedInfo));

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
        showStudentList(allFinishedInfo.rawData);
    }

    // 年級顏色調整函式
    function gradeColorAdjustment(grade) {
        /* 
        年級顏色調整 
        功能： 
        1. 依照年級調整顏色。
        */
        let l = GRADE[grade];
        let tag = '';
        if (l <= 6) {
            tag = `<span class="badge bg-success">${grade}</span>`;
        } else if (l <= 9) {
            tag = `<span class="badge bg-warning">${grade}</span>`;
        } else if (l <= 12) {
            tag = `<span class="badge bg-danger">${grade}</span>`;
        } else {
            tag = `<span class="badge bg-primary">${grade}</span>`;
        }
        return tag;
    }

    // 學生名單顯示函式
    function showStudentList(chosenStudentList) {
        /* 
        學生名單顯示
        功能：顯示對應的學生名單。
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
            for (let [studentName, tr] of Object.entries(classroom.students)) {
                document.querySelector("#studentList").innerHTML += `
                <div class="card">
                    <div class="card-header text-bg-primary">
                        <h4 class="card-title">${studentName}</h4>
                    </div>
                    <div class="card-body">
                        <p class="card-text">
                            <h5 class="card-title">年級</h5>
                            <h4 class="card-subtitle mb-3">${gradeColorAdjustment(tr.grade)}</h4>
                        </p>
                        <p class="card-text">
                            <h5 class="card-title">名單上課程名稱</h5>
                            <h4 class="card-subtitle mb-2"><span class="badge bg-dark">${tr.course}</span></h4>
                        </p>
                        <a href="${tr.userPageURL}" target="_blank" class="card-link">個人頁面</a>
                        <span> | </span>
                        <a href="${tr.parentPageURL}" title="${tr.parentName}" target="_blank" class="card-link">家長頁面</a>
                        <span> | </span>
                        <a href="${classroom.classroomURL}" title="${classroom.classroomName}" target="_blank" class="card-link">原教室頁面</a>
                    </div>
                </div>`;
            }

        }
    }

    // 根據年級選單，顯示對應的學生名單
    function adjustWithGrade(eVal) {
        /* 
        根據年級選單，顯示對應的學生名單
        功能： 
        1. 根據年級選單，顯示對應的學生名單。
        */
        let chosenStudentList = [];
        if (eVal === "all") {
            return allFinishedInfo.rawData;
        }
        for (let classroom of allFinishedInfo.rawData) {
            let innerObj = {
                classroomName: classroom.classroomName,
                classroomURL: classroom.classroomURL,
                students: {},
            }
            for (let [studentName, info] of Object.entries(classroom.students)) {
                if (eVal === "elementary") {
                    if (GRADE[info.grade] <= 6) {
                        innerObj.students[studentName] = info;
                    }
                } else if (eVal === "junior-high") {
                    if (GRADE[info.grade] <= 9 && GRADE[info.grade] >= 7) {
                        innerObj.students[studentName] = info;
                    }
                } else if (eVal === "senior-high") {
                    if (GRADE[info.grade] >= 10 && GRADE[info.grade] <= 12) {
                        innerObj.students[studentName] = info;
                    }
                }
            }
            chosenStudentList.push(innerObj);
        }
        return chosenStudentList;
    }

    // 根據課程選單，顯示對應的學生名單
    function adjustWithCourse(eVal) {
        /* 
        根據課程選單，顯示對應的學生名單
        功能： 
        1. 根據課程選單，顯示對應的學生名單。
        */
        let chosenStudentList = [];
        if (eVal === "all") {
            return allFinishedInfo.rawData;
        }
        for (let classroom of allFinishedInfo.rawData) {
            let innerObj = {
                classroomName: classroom.classroomName,
                classroomURL: classroom.classroomURL,
                students: {},
            }
            for (let [studentName, info] of Object.entries(classroom.students)) {
                if (info.course.includes(eVal)) {
                    innerObj.students[studentName] = info;
                }
            }
            chosenStudentList.push(innerObj);
        }
        return chosenStudentList;
    }

    // 加入懸浮訊息小視窗 
    function addFloatingMessageWindow() {
        /* 
        加入懸浮訊息小視窗 
        功能： 
        1. 縮圖為圓圈，內帶有 KH 字樣。
        2. 點擊後，會顯示展開一個小視窗，內容為取得的學生名單內容。
        */
        let floatingMessageWindow = document.createElement("div");
        floatingMessageWindow.classList.add("floating-message-window-shrinked");
        floatingMessageWindow.innerHTML = "KH";
        floatingMessageWindow.title = "點擊展開小視窗";
        document.body.appendChild(floatingMessageWindow);
        return floatingMessageWindow;
    }

    // 懸浮訊息小視窗點擊後會展開小視窗的函式
    function showExtendedFloatingMessageWindow() {
        /* 
        懸浮訊息小視窗 
        功能： 
        1. 點選小視窗右上角的「X」按鈕，可以縮小小視窗。
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
            <div id="floating-message-window-title">各班級完課學生名單</div>
            <button id="minimize-btn" type="button" class="btn-close" aria-label="Close"></button>
        </div>
        <div class="d-flex justify-content-between align-items-center pt-2 pb-3" style="width: 100%;">
            <div>
                <button id="updateRawData" class='btn btn-outline-dark' title="${TITLEHINT.updateRawData}">更新學生名單</button>
                <button id="currentData" class='btn btn-success' title="${TITLEHINT.currentData}">${TITLEHINT.currentData}</button>
            </div>
            <div class="d-flex justify-content-between align-items-center my-2">
                <select class="form-select mr-1" name="grades" id="grades-select">
                    <option value="all">全部年級</option>
                    <option value="elementary">國小</option>
                    <option value="junior-high">國中</option>
                    <option value="senior-high">高中</option>
                </select>
                <select class="form-select" name="courses" id="courses-select">
                    <option value="all">全部課程</option>
                    <option value="Scratch實戰班">SB</option>
                    <option value="Scratch菁英班">SA</option>
                    <option value="Python">PY</option>
                    <option value="JavaScript">JS</option>
                    <option value="HTML5">HTML5</option>
                    <option value="網路與資料庫">DB</option>
                    <option value="演算法">ALGO</option>
                    <option value="AI">AI</option>
                </select>
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
            .addEventListener("click", showStudentList.bind(null, allFinishedInfo.rawData), false);

        // TODO: 目前無法使用年級與課程同時過濾的功能，需再修正
        // 年級選單點擊事件
        document.querySelector("#grades-select")
            .addEventListener("change", (e) => {
                document.querySelector("#courses-select").value = "all";
                chosenStudentList = adjustWithGrade(e.target.value);
                showStudentList(chosenStudentList);
            });

        // TODO: 目前無法使用年級與課程同時過濾的功能，需再修正
        // 課程選單點擊事件
        document.querySelector("#courses-select")
            .addEventListener("change", (e) => {
                document.querySelector("#grades-select").value = "all";
                chosenStudentList = adjustWithCourse(e.target.value);
                showStudentList(chosenStudentList);
            });

        // 下載資料按鈕點擊事件
        document.querySelector("#downloadData")
            .addEventListener("click", () => {
                let fileName = 'FinishedStudentList';
                let code = '';
                for (let classroom of chosenStudentList) {
                    code += `${classroom.classroomName} - ${classroom.classroomURL} \n`;
                    for (let [studentName, info] of Object.entries(classroom.students)) {
                        code += `${studentName} - ${info.userPageURL} - ${info.grade} - ${info.parentName} - ${info.parentPageURL} - ${info.course}`;
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
        showStudentList(allFinishedInfo.rawData);
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
        floatingMessageWindow.innerHTML = "KH";
        floatingMessageWindow.title = "點擊展開小視窗";
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
        inputURLArea.value = allFinishedInfo.classroomLinks.length !== 0 ? allFinishedInfo.classroomLinks.join("\n") : '';
        document.querySelector("#updateURL")
            .addEventListener("click", async () => {
                let inputURL = document.querySelector("#inputURL").value;
                let classroomLinks = inputURL.split("\n");
                allFinishedInfo.classroomLinks = classroomLinks;
                localStorage.setItem("allFinishedInfo", JSON.stringify(allFinishedInfo));
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
})();
