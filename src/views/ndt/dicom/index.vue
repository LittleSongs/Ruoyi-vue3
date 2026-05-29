<template>
  <div class="app-container">
    <el-form ref="queryRef" :model="queryParams" :inline="true" v-show="showSearch">
      <el-form-item label="任务ID" prop="taskId"><el-input v-model="queryParams.taskId" placeholder="任务ID" clearable style="width: 120px" @keyup.enter="handleQuery" /></el-form-item>
      <el-form-item label="工件名称" prop="workpieceName"><el-input v-model="queryParams.workpieceName" placeholder="工件名称" clearable style="width: 160px" @keyup.enter="handleQuery" /></el-form-item>
      <el-form-item label="Study UID" prop="studyInstanceUid"><el-input v-model="queryParams.studyInstanceUid" placeholder="StudyInstanceUID" clearable style="width: 240px" @keyup.enter="handleQuery" /></el-form-item>
      <el-form-item label="完整性" prop="integrityStatus">
        <el-select v-model="queryParams.integrityStatus" clearable placeholder="状态" style="width: 130px">
          <el-option v-for="dict in ndt_integrity_status" :key="dict.value" :label="dict.label" :value="dict.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5"><el-button type="primary" plain icon="Upload" @click="uploadOpen = true" v-hasPermi="['ndt:dicom:upload']">上传DICOM</el-button></el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-row>

    <el-table v-loading="loading" :data="dicomList">
      <el-table-column label="工件名称" prop="workpieceName" min-width="140" :show-overflow-tooltip="true" />
      <el-table-column label="StudyInstanceUID" prop="studyInstanceUid" min-width="230" :show-overflow-tooltip="true" />
      <el-table-column label="SeriesInstanceUID" prop="seriesInstanceUid" min-width="230" :show-overflow-tooltip="true" />
      <el-table-column label="SOPInstanceUID" prop="sopInstanceUid" min-width="230" :show-overflow-tooltip="true" />
      <el-table-column label="Modality" prop="modality" width="90" align="center" />
      <el-table-column label="Series描述" prop="seriesDescription" min-width="150" :show-overflow-tooltip="true" />
      <el-table-column label="Instance" prop="instanceNumber" width="90" align="center" />
      <el-table-column label="完整性" prop="integrityStatus" width="100" align="center">
        <template #default="scope"><dict-tag :options="ndt_integrity_status" :value="scope.row.integrityStatus" /></template>
      </el-table-column>
      <el-table-column label="上传时间" prop="uploadTime" width="160" align="center"><template #default="scope">{{ parseTime(scope.row.uploadTime) }}</template></el-table-column>
      <el-table-column label="操作" width="240" align="center" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="Download" @click="handleDownload(scope.row)" v-hasPermi="['ndt:dicom:download']">下载</el-button>
          <el-button link type="primary" icon="Refresh" @click="handleVerify(scope.row)" v-hasPermi="['ndt:integrity:verify']">校验</el-button>
          <el-button link type="primary" icon="Picture" @click="openOhif(scope.row)" v-hasPermi="['ndt:task:ohif']">OHIF</el-button>
        </template>
      </el-table-column>
    </el-table>
    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog title="上传DICOM文件" v-model="uploadOpen" width="620px" append-to-body>
      <el-form label-width="90px">
        <el-form-item label="检测任务">
          <el-select v-model="uploadTaskId" filterable placeholder="请选择任务" style="width: 100%">
            <el-option v-for="task in taskOptions" :key="task.id" :label="task.taskNo + ' / ' + task.taskName" :value="task.id" />
          </el-select>
        </el-form-item>
        <el-upload ref="uploadRef" drag accept=".dcm" :auto-upload="false" :limit="1" :on-change="file => selectedFile = file.raw" :on-remove="() => selectedFile = undefined">
          <el-icon class="el-icon--upload"><upload-filled /></el-icon>
          <div class="el-upload__text">将 .dcm 文件拖到此处，或<em>点击选择</em></div>
        </el-upload>
      </el-form>
      <template #footer>
        <el-button type="primary" :loading="uploading" @click="submitUpload">上传归档</el-button>
        <el-button @click="uploadOpen = false">取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="NdtDicom">
import { UploadFilled } from "@element-plus/icons-vue"
import { saveAs } from "file-saver"
import { listDicom, uploadDicom, getDicomOhif, downloadDicom } from "@/api/ndt/dicom"
import { verifyIntegrity } from "@/api/ndt/integrity"
import { listTask } from "@/api/ndt/task"

const { proxy } = getCurrentInstance()
const { ndt_integrity_status } = useDict("ndt_integrity_status")
const loading = ref(true)
const showSearch = ref(true)
const dicomList = ref([])
const total = ref(0)
const uploadOpen = ref(false)
const uploading = ref(false)
const uploadRef = ref()
const selectedFile = ref()
const uploadTaskId = ref()
const taskOptions = ref([])
const queryParams = reactive({ pageNum: 1, pageSize: 10, taskId: undefined, workpieceName: undefined, studyInstanceUid: undefined, integrityStatus: undefined })

function getList() {
  loading.value = true
  listDicom(queryParams).then(res => { dicomList.value = res.rows; total.value = res.total }).finally(() => { loading.value = false })
}
function loadTasks() { listTask({ pageNum: 1, pageSize: 300 }).then(res => { taskOptions.value = res.rows }) }
function handleQuery() { queryParams.pageNum = 1; getList() }
function resetQuery() { proxy.resetForm("queryRef"); handleQuery() }
function submitUpload() {
  if (!uploadTaskId.value) return proxy.$modal.msgWarning("请选择检测任务")
  if (!selectedFile.value) return proxy.$modal.msgWarning("请选择 .dcm 文件")
  const data = new FormData()
  data.append("taskId", uploadTaskId.value)
  data.append("file", selectedFile.value)
  uploading.value = true
  uploadDicom(data).then(() => {
    proxy.$modal.msgSuccess("上传归档成功")
    uploadOpen.value = false
    uploadRef.value.clearFiles()
    selectedFile.value = undefined
    getList()
  }).finally(() => { uploading.value = false })
}
function handleVerify(row) {
  verifyIntegrity(row.id).then(() => { proxy.$modal.msgSuccess("校验完成"); getList() })
}
function openOhif(row) {
  getDicomOhif(row.id).then(res => { window.open(res.msg, "_blank") })
}
function handleDownload(row) {
  downloadDicom(row.id).then(blob => { saveAs(blob, row.fileName || `dicom-${row.id}.dcm`) })
}
onMounted(() => { loadTasks(); getList() })
</script>
