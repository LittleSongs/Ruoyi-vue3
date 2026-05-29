import request from '@/utils/request'

export function listDicom(query) {
  return request({ url: '/ndt/dicom/list', method: 'get', params: query })
}

export function getDicom(id) {
  return request({ url: '/ndt/dicom/' + id, method: 'get' })
}

export function uploadDicom(data) {
  return request({
    url: '/ndt/dicom/upload',
    method: 'post',
    data,
    headers: { 'Content-Type': 'multipart/form-data', repeatSubmit: false },
    timeout: 60000
  })
}

export function getDicomOhif(id) {
  return request({ url: '/ndt/dicom/' + id + '/ohif', method: 'get' })
}

export function downloadDicom(id) {
  return request({ url: '/ndt/dicom/download/' + id, method: 'get', responseType: 'blob' })
}
