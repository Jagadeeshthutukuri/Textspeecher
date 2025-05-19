document.addEventListener('DOMContentLoaded', () => {
    const ttsButton = document.getElementById('tts-button');
    const ttsText = document.getElementById('tts-text');
    const ttsAudio = document.getElementById('tts-audio');

    const sttButton = document.getElementById('stt-button');
    const sttStatus = document.getElementById('stt-status');
    const sttText = document.getElementById('stt-text');

    const sttFileInput = document.getElementById('stt-file');
    const sttUploadButton = document.getElementById('stt-upload-button');

    const docButton = document.getElementById('doc-button');
    const docFileInput = document.getElementById('doc-file');
    const docAudio = document.getElementById('doc-audio');
    const docStatus = document.getElementById('doc-status');

    const downloadDocButton = document.getElementById('download-doc-button');
    const downloadPdfButton = document.getElementById('download-pdf-button');

    let mediaRecorder;
    let audioChunks = [];

    ttsButton.addEventListener('click', () => {
        const text = ttsText.value.trim();
        if (!text) {
            alert('Please enter some text for text-to-speech.');
            return;
        }
        fetch('/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Text-to-speech conversion failed.');
            }
            return response.blob();
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            ttsAudio.src = url;
            ttsAudio.play();
        })
        .catch(error => {
            alert(error.message);
        });
    });

    sttButton.addEventListener('click', () => {
        if (!window.MediaRecorder) {
            alert('MediaRecorder not supported in this browser.');
            return;
        }

        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            sttButton.textContent = 'Start Recording';
            sttStatus.textContent = 'Processing audio...';
        } else {
            navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                audioChunks = [];

                mediaRecorder.addEventListener('dataavailable', event => {
                    audioChunks.push(event.data);
                });

                mediaRecorder.addEventListener('stop', () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'recording.webm');

                    fetch('/stt', {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => {
                        const contentType = response.headers.get('content-type');
                        if (contentType && contentType.indexOf('application/json') !== -1) {
                            return response.json();
                        } else {
                            return response.text().then(text => { throw new Error('Unexpected response: ' + text); });
                        }
                    })
                    .then(data => {
                        if (data.error) {
                            sttStatus.textContent = 'Error: ' + data.error;
                            sttText.value = '';
                            downloadDocButton.disabled = true;
                            downloadPdfButton.disabled = true;
                        } else {
                            sttStatus.textContent = 'Recognition successful!';
                            sttText.value = data.text;
                            downloadDocButton.disabled = false;
                            downloadPdfButton.disabled = false;
                        }
                    })
                    .catch(error => {
                        sttStatus.textContent = 'Error processing speech-to-text: ' + error.message;
                        sttText.value = '';
                        downloadDocButton.disabled = true;
                        downloadPdfButton.disabled = true;
                    });
                });

                mediaRecorder.addEventListener('error', e => {
                    console.error("MediaRecorder error:", e);
                });

                mediaRecorder.start();
                console.log("MediaRecorder started:", mediaRecorder);
                sttButton.textContent = 'Stop Recording';
                sttStatus.textContent = 'Recording...';
            })
            .catch((err) => {
                console.error("Microphone error:", err);
                alert('Could not access microphone. Please check your browser settings and permissions.');
            });
        }
    });

    sttUploadButton.addEventListener('click', () => {
        const file = sttFileInput.files[0];
        if (!file) {
            alert('Please select an audio file to upload.');
            return;
        }
        sttStatus.textContent = 'Processing uploaded audio...';
        const formData = new FormData();
        formData.append('audio', file);

        fetch('/stt', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.indexOf('application/json') !== -1) {
                return response.json();
            } else {
                return response.text().then(text => { throw new Error('Unexpected response: ' + text); });
            }
        })
        .then(data => {
            if (data.error) {
                sttStatus.textContent = 'Error: ' + data.error;
                sttText.value = '';
                downloadDocButton.disabled = true;
                downloadPdfButton.disabled = true;
            } else {
                sttStatus.textContent = 'Recognition successful!';
                sttText.value = data.text;
                downloadDocButton.disabled = false;
                downloadPdfButton.disabled = false;
            }
        })
        .catch(error => {
            sttStatus.textContent = 'Error processing uploaded audio: ' + error.message;
            sttText.value = '';
            downloadDocButton.disabled = true;
            downloadPdfButton.disabled = true;
        });
    });

    docButton.addEventListener('click', () => {
        const file = docFileInput.files[0];
        if (!file) {
            alert('Please select a document file (PDF or DOCX).');
            return;
        }
        docStatus.textContent = 'Processing document...';
        const formData = new FormData();
        formData.append('document', file);

        fetch('/doc-to-speech', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Document to speech conversion failed.');
            }
            return response.blob();
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            docAudio.src = url;
            docAudio.play();
            docStatus.textContent = 'Conversion successful!';
        })
        .catch(error => {
            docStatus.textContent = 'Error: ' + error.message;
        });
    });

    // Function to download text as DOC file
    function downloadAsDoc(text) {
        const header = "Content-Type: application/msword;charset=utf-8";
        const blob = new Blob(['\ufeff', text], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'converted_text.doc';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }

    // Function to download text as PDF file using jsPDF
    function downloadAsPdf(text) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        const margin = 10;
        const maxLineWidth = doc.internal.pageSize.width - margin * 2;
        const lines = doc.splitTextToSize(text, maxLineWidth);
        let cursorY = margin;

        lines.forEach(line => {
            if (cursorY + 10 > pageHeight - margin) {
                doc.addPage();
                cursorY = margin;
            }
            doc.text(line, margin, cursorY);
            cursorY += 10;
        });

        doc.save('converted_text.pdf');
    }

    downloadDocButton.addEventListener('click', () => {
        const text = sttText.value.trim();
        if (!text) {
            alert('No text available to download.');
            return;
        }
        downloadAsDoc(text);
    });

    downloadPdfButton.addEventListener('click', () => {
        const text = sttText.value.trim();
        if (!text) {
            alert('No text available to download.');
            return;
        }
        downloadAsPdf(text);
    });

    // Initially disable download buttons
    downloadDocButton.disabled = true;
    downloadPdfButton.disabled = true;
});
