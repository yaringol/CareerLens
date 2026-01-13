import React from 'react'
import './SkillDetails.css'

interface SkillDetailsProps {
  jobRequirements: string[]
  cvMentions: string[]
  strengths: string[]
  missingElements: string[]
}

const SkillDetails: React.FC<SkillDetailsProps> = ({
  jobRequirements,
  cvMentions,
  strengths,
  missingElements,
}) => {
  return (
    <div className="skill-details">
      <div className="comparison-section">
        <div className="comparison-column">
          <div className="comparison-header">
            <span className="comparison-icon job-icon">ℹ️</span>
            <h3 className="comparison-title">Job Requirement:</h3>
          </div>
          <ul className="comparison-list">
            {jobRequirements.map((req, index) => (
              <li key={index} className="comparison-item">{req}</li>
            ))}
          </ul>
        </div>

        <div className="comparison-column">
          <div className="comparison-header">
            <span className="comparison-icon cv-icon">✓</span>
            <h3 className="comparison-title">Your CV Mentions:</h3>
          </div>
          <ul className="comparison-list">
            {cvMentions.length > 0 ? (
              cvMentions.map((mention, index) => (
                <li key={index} className="comparison-item">{mention}</li>
              ))
            ) : (
              <li className="comparison-item empty">No specific mentions found</li>
            )}
          </ul>
        </div>
      </div>

      <div className="gap-analysis-section">
        <h3 className="gap-analysis-title">Gap Analysis</h3>
        
        {strengths.length > 0 && (
          <div className="strengths-box">
            {strengths.map((strength, index) => (
              <div key={index} className="gap-item strength">
                <span className="gap-icon">✓</span>
                <span className="gap-text">{strength}</span>
              </div>
            ))}
          </div>
        )}

        {missingElements.length > 0 && (
          <div className="missing-box">
            {missingElements.map((missing, index) => (
              <div key={index} className="gap-item missing">
                <span className="gap-icon">⚠️</span>
                <span className="gap-text">{missing}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SkillDetails
