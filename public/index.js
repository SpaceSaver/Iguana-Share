window.onload = () => {
  document.getElementById("upload").addEventListener("click", () => {
    const fileElem = document.getElementById("fileUpload");
    const selectedFile = fileElem.files[0];
    FileUpload(selectedFile);
  });
};
function FileUpload(file) {
  const reader = new FileReader();
  const xhr = new XMLHttpRequest();
  this.xhr = xhr;
  const pbar = document.getElementById("uploadp");
  const self = this;
  this.xhr.upload.addEventListener("progress", (e) => {
    if (e.lengthComputable) {
      const percentage = Math.round((e.loaded * 100) / e.total);
      pbar.textContent = percentage + "%";
      pbar.value = percentage;
    }
  }, false);

  xhr.upload.addEventListener("load", (e) => {
    pbar.value = 100;
    pbar.textContent = "100%";
  }, false);
  xhr.addEventListener("load", () => {
    document.getElementById("download").href = `${(new URL(location.href)).origin}/download/${xhr.responseText}`;
    document.getElementById("download").textContent = `${(new URL(location.href)).origin}/download/${xhr.responseText}`;
    document.getElementById("download").style.display = "";
  })
  const uploadUrl = new URL("/upload", window.location.href);
  uploadUrl.searchParams.set("title", file.name);
  uploadUrl.searchParams.set("author", "guest");
  xhr.open("POST", uploadUrl);
  // xhr.overrideMimeType('application/octet-stream');
  xhr.setRequestHeader("Content-Type", "application/octet-stream");
  reader.onload = (evt) => {
    xhr.send(evt.target.result);
  };
  reader.readAsArrayBuffer(file);
}