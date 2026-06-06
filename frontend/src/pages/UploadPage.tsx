import CvUploadSection from '../components/upload/CvUploadSection'
import './HomePage.css'

/** Standalone upload route — same form as home page, without hero/marketing */
export default function UploadPage() {
  return (
    <div className="home-page">
      <CvUploadSection visible showBackLink />
    </div>
  )
}
